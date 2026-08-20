import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Phase 6: deploy ขึ้น GitHub Pages ที่ https://fourthy89.github.io/bancheebao/
// ต้องตั้ง base ให้ตรงกับชื่อ repo ไม่งั้น asset จะโหลดไม่ขึ้น (หน้าขาว/404)
export default defineConfig({
  plugins: [react()],
  base: "/bancheebao/",
});
