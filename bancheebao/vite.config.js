import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// NOTE: ตอน Phase 6 (deploy ขึ้น GitHub Pages) ต้องกลับมาตั้งค่า `base`
// ให้ตรงกับชื่อ repo เช่น base: "/bancheebao/"
// ไม่งั้น asset จะโหลดไม่ขึ้น (หน้าขาว/404) เพราะ repo ไม่ได้อยู่ที่ root domain
export default defineConfig({
  plugins: [react()],
  // base: "/bancheebao/", // <-- เปิดใช้ตอน deploy จริงใน Phase 6
});
