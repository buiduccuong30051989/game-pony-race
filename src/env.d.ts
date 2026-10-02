// Module ảo do vite.config.ts sinh: ảnh thật người nhà có trong public/family/ ({ 'me-yen': 'me-yen.jpg', ... }).
declare module 'virtual:family-photos' {
  const photos: Record<string, string>;
  export default photos;
}
// Module ảo do vite.config.ts sinh: tên file ảnh thật của Nhím trong public/photos/ (có thể rỗng).
declare module 'virtual:nhim-photos' {
  const files: string[];
  export default files;
}
