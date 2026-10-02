#!/usr/bin/env python3
"""Sinh audio tiếng Việt bằng Microsoft Hoài My (edge-tts) từ scripts/audio/_all.gen.txt → public/audio/<key>.m4a.

Dùng (qua `pnpm audio`, chạy scripts/audio-lines.mjs trước):
    scripts/.venv/bin/python scripts/gen-audio.py            # chỉ sinh câu mới / câu đã đổi chữ hoặc đổi giọng
    scripts/.venv/bin/python scripts/gen-audio.py --force    # sinh lại tất cả
    scripts/.venv/bin/python scripts/gen-audio.py c_b v_a    # sinh lại vài khoá

Bẫy đã biết (thử 02/10/2026):
  - Câu ngắn ("vit", "vít vít") đôi khi trả về RỖNG → thử lại tới 5 lần, vẫn rỗng thì DỪNG và báo lỗi (exit 1).
  - Mỗi clip có ~0.15–0.2 s lặng đầu và >1 s lặng cuối → cắt theo ngưỡng −42 dBFS (chừa 25 ms đầu, 60 ms cuối),
    để chuỗi đánh vần (bờ – a – ba) không hở.
Pipeline: edge-tts mp3 → afconvert ra wav 16-bit → cắt lặng (module wave, không cần ffmpeg) → afconvert m4a AAC 64 kbps.
Tên riêng tiếng Anh viết trong {ngoặc nhọn}: đoạn đó sinh bằng giọng tiếng Anh của nhân vật (VOICES[].en), các đoạn tiếng Việt
bằng giọng Việt; từng đoạn cắt lặng rồi GHÉP, cách nhau GAP_MS = 80 ms ("Fluttershy" [EN] + "nói: cảm ơn Nhím nhé!" [VI]).
Cần macOS (afconvert). Sổ `scripts/audio/.done.json` nhớ câu + giọng của từng file để biết file nào cần sinh lại.
"""
import array
import asyncio
import hashlib
import json
import math
import os
import subprocess
import sys
import tempfile
import wave

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'scripts/audio/_all.gen.txt')
OUT = os.path.join(ROOT, 'public/audio')
DONE = os.path.join(ROOT, 'scripts/audio/.done.json')
CONCURRENCY = 3
RETRIES = 5
THRESH_DB = -42.0
LEAD_MS = 25
TAIL_MS = 60
GAP_MS = 80
EN_RATE = '-6%'


def read_lines():
    voices, lines = {}, []
    with open(SRC, encoding='utf-8') as f:
        for raw in f:
            raw = raw.rstrip('\n')
            if raw.startswith('#voice '):
                name, voice, rate, pitch, en, en_pitch = raw[7:].split('|')
                voices[name] = (voice, rate, pitch, en, en_pitch)
            elif raw and not raw.startswith('#'):
                key, v, text = raw.split('|', 2)
                lines.append((key, v, text))
    return voices, lines


def trim_wav(src):
    """Đọc wav 16-bit, cắt lặng đầu/cuối theo ngưỡng → (mảng mẫu mono, tần số)."""
    with wave.open(src, 'rb') as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        data = w.readframes(n)
    assert sw == 2, 'cần wav 16-bit'
    a = array.array('h', data)
    if ch > 1:
        a = array.array('h', a[::ch])
    win = max(1, sr // 200)  # 5 ms
    thr = 32768 * 10 ** (THRESH_DB / 20)
    loud = []
    for i in range(0, len(a), win):
        seg = a[i:i + win]
        rms = math.sqrt(sum(x * x for x in seg) / len(seg)) if seg else 0
        loud.append(rms > thr)
    if not any(loud):
        raise RuntimeError('clip toàn lặng')
    first = loud.index(True) * win
    last = (len(loud) - 1 - loud[::-1].index(True)) * win + win
    start = max(0, first - sr * LEAD_MS // 1000)
    end = min(len(a), last + sr * TAIL_MS // 1000)
    out = a[start:end]
    fade = sr // 200
    for i in range(min(fade, len(out))):
        out[i] = int(out[i] * i / fade)
        out[-1 - i] = int(out[-1 - i] * i / fade)
    return out, sr


def write_wav(dst, samples, sr):
    with wave.open(dst, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(samples.tobytes())


def segments(text):
    """'Mình là {Fluttershy}! Cảm ơn' → [('vi', 'Mình là'), ('en', 'Fluttershy'), ('vi', '! Cảm ơn')] (bỏ đoạn rỗng/chỉ dấu câu)."""
    out, i = [], 0
    while i < len(text):
        j = text.find('{', i)
        if j < 0:
            out.append(('vi', text[i:])); break
        if j > i:
            out.append(('vi', text[i:j]))
        k = text.index('}', j)
        out.append(('en', text[j + 1:k]))
        i = k + 1
    return [(lang, t.strip()) for lang, t in out if any(ch.isalnum() for ch in t)]


async def synth(text, voice, rate, pitch):
    for attempt in range(1, RETRIES + 1):
        try:
            com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            buf = bytearray()
            async for chunk in com.stream():
                if chunk['type'] == 'audio':
                    buf.extend(chunk['data'])
            if len(buf) > 800:
                return bytes(buf)
            print(f'  ! rỗng (lần {attempt}): "{text}"', flush=True)
        except Exception as e:  # mạng chập chờn
            print(f'  ! lỗi (lần {attempt}): "{text}": {e}', flush=True)
        await asyncio.sleep(1.5 * attempt)
    raise RuntimeError(f'edge-tts trả về rỗng {RETRIES} lần: "{text}"')


async def main():
    force = '--force' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    voices, lines = read_lines()
    done = {}
    if os.path.exists(DONE):
        with open(DONE, encoding='utf-8') as f:
            done = json.load(f)
    os.makedirs(OUT, exist_ok=True)
    todo = []
    for key, v, text in lines:
        sig = hashlib.sha1('|'.join([*voices[v], EN_RATE, str(GAP_MS), text]).encode()).hexdigest()[:12]
        path = os.path.join(OUT, key + '.m4a')
        if only and key not in only:
            continue
        if not force and not only and done.get(key) == sig and os.path.exists(path):
            continue
        todo.append((key, v, text, sig, path))
    print(f'gen-audio: {len(todo)} / {len(lines)} clip cần sinh', flush=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    failed = []
    tmp = tempfile.mkdtemp(prefix='nhim-audio-')

    async def one(key, v, text, sig, path):
        async with sem:
            voice, rate, pitch, en, en_pitch = voices[v]
            try:
                parts, sr0 = [], None
                for n, (lang, seg) in enumerate(segments(text)):
                    if lang == 'en':
                        mp3 = await synth(seg, en, EN_RATE, en_pitch)
                    else:
                        mp3 = await synth(seg, voice, rate, pitch)
                    p_mp3, p_wav = (os.path.join(tmp, f'{key}.{n}{e}') for e in ('.mp3', '.wav'))
                    with open(p_mp3, 'wb') as f:
                        f.write(mp3)
                    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', p_mp3, p_wav], check=True, capture_output=True)
                    samples, sr = trim_wav(p_wav)
                    if sr0 is None:
                        sr0 = sr
                    assert sr == sr0, f'tần số lệch {sr} ≠ {sr0}'
                    if parts:
                        parts.append(array.array('h', bytes(2 * (sr * GAP_MS // 1000))))
                    parts.append(samples)
                allsamples = array.array('h')
                for ptr in parts:
                    allsamples.extend(ptr)
                p_cut = os.path.join(tmp, key + '.cut.wav')
                write_wav(p_cut, allsamples, sr0)
                dur = len(allsamples) / sr0
                subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', p_cut, path], check=True, capture_output=True)
                done[key] = sig
                print(f'  ✓ {key} ({dur:.2f}s) {text}', flush=True)
            except Exception as e:
                failed.append((key, text, str(e)))
                print(f'  ✗ {key}: {e}', flush=True)

    await asyncio.gather(*(one(*t) for t in todo))
    # bỏ khoá không còn trong danh sách (file m4a cũ không xoá tự động: xoá tay nếu muốn)
    keys = {k for k, _, _ in lines}
    done = {k: v for k, v in done.items() if k in keys}
    with open(DONE, 'w', encoding='utf-8') as f:
        json.dump(done, f, indent=0, sort_keys=True)
    stale = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.m4a') and f[:-4] not in keys)
    if stale:
        print(f'gen-audio: {len(stale)} file m4a không còn dùng: {", ".join(stale[:12])}{" …" if len(stale) > 12 else ""}')
    if failed:
        print(f'\ngen-audio: ✗ {len(failed)} clip LỖI:')
        for k, t, e in failed:
            print(f'  {k} "{t}": {e}')
        sys.exit(1)
    print('gen-audio: xong')


if __name__ == '__main__':
    asyncio.run(main())
