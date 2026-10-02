// Một người chạy trên đường (Nhím, người nhà, bạn được cứu): quãng đường s, tốc độ, làn (lệch ngang), nhánh rẽ, nhảy /
// bay qua chướng ngại, tăng tốc cầu vồng / chậm vì bùn. Hình là 1 Pony đặt theo Track.pose mỗi khung.
import * as THREE from 'three';
import type { Pony } from './pony';
import { Track, type Pose } from './track';

/** Bay qua chướng ngại: cao FLY_H trong FLY_T giây (thời gian game). */
export const FLY_H = 2.5;
export const FLY_T = 1.15;

export class Runner {
  s = 0;
  v = 0;
  /** lệch ngang hiện tại / mục tiêu (m) */
  lat = 0;
  latGoal = 0;
  /** nhánh rẽ: −1 trái, +1 phải, 0 = chưa chọn (đi giữa) */
  side = 0;
  y = 0;
  private flyT = -1;
  boostT = 0;
  mudT = 0;
  /** bay suốt (màn trời) */
  alwaysFly = false;
  /** đã qua vạch đích lúc (giây game) */
  finishedAt = -1;
  readonly pose: Pose = Track.newPose();

  constructor(readonly pony: Pony, readonly track: Track) {}

  get airborne(): boolean { return this.flyT >= 0; }

  /** Vỗ cánh bay qua (không bay lại khi đang bay). */
  fly(): boolean {
    if (this.flyT >= 0 || this.alwaysFly) return false;
    this.flyT = 0;
    this.pony.flying = true;
    return true;
  }

  /** Tốc độ mục tiêu → tốc độ thật (tăng 9 m/s², giảm 12 m/s²), tiến s, cập nhật hình. */
  update(gdt: number, dt: number, want: number): void {
    if (this.boostT > 0) { this.boostT -= gdt; want *= 1.45; }
    if (this.mudT > 0) { this.mudT -= gdt; want *= 0.6; }
    // đang bay qua chướng ngại: giữ đà (bé nhấc tay khỏi nút chạy để chạm nút cánh vẫn bay qua được)
    if (this.flyT >= 0 && want < this.v) want = this.v;
    const a = want > this.v ? 9 : 12;
    this.v += Math.sign(want - this.v) * Math.min(Math.abs(want - this.v), a * gdt);
    this.s = this.track.closed ? this.s + this.v * gdt : Math.min(this.track.length, this.s + this.v * gdt);
    this.lat += (this.latGoal - this.lat) * Math.min(1, gdt * 5);
    if (this.flyT >= 0) {
      this.flyT += gdt;
      const k = this.flyT / FLY_T;
      this.y = FLY_H * Math.sin(Math.min(1, k) * Math.PI);
      if (k >= 1) { this.flyT = -1; this.y = 0; this.pony.flying = false; this.pony.land(); }
    }
    if (this.alwaysFly) this.pony.flying = true;
    // về nhánh giữa khi đã qua ngã rẽ
    if (this.side && !this.track.forkAt(this.s).fork) this.side = 0;
    this.track.pose(this.s, this.lat, this.side, this.pose);
    this.pony.run = Math.min(1, this.v / 9);
    this.pony.place(this.pose.pos, this.pose.yaw, this.alwaysFly ? 0 : this.pose.pitch, this.y);
    this.pony.update(gdt, dt);
  }

  /** Điểm thế giới ở giữa người (đã tính bay). */
  center(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.pose.pos).add(new THREE.Vector3(0, this.y + this.pony.hover + this.pony.height * 0.55, 0));
  }
}
