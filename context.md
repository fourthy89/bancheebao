# context.md — BancheeBao (บัญชีเบา) เว็บแอปบัญชีรายรับรายจ่าย

อัปเดตล่าสุด: 2026-08-12 (รอบล่าสุด: ตั้งชื่อโปรเจกต์ "BancheeBao" + เริ่ม Phase 1 Supabase)

## ชื่อโปรเจกต์
- **ชื่อที่โชว์บนเว็บ**: BancheeBao (บัญชีเบา)
- **ชื่อ repo GitHub / Supabase project**: `bancheebao` (ตัวเล็กทั้งหมด ไม่มีช่องว่าง — ตาม URL ข้อกำหนด GitHub Pages)

## กฎการทำงาน (จาก คำสั่ง.txt)
1. ทุกงานที่ทำต้องสรุป: ทำอะไร / ส่วนไหน / รายละเอียด / ผลลัพธ์ / path ที่จะนำไปใช้
2. ห้ามยุ่งกับระบบหลักเด็ดขาด
3. ต้องรอคอนเฟิร์มก่อนลงมือทำจริงเสมอ
4. งานสร้างใหม่ทุกครั้งต้องระบุ: รายละเอียดสิ่งที่สร้าง, ความปลอดภัย, ผลลัพธ์, แนบไฟล์ดาวน์โหลด
5. ต้องมี context.md เสมอ — ไม่มีให้สร้าง มีแล้วให้ update ให้ตรงปัจจุบัน

## เป้าหมายโปรเจกต์
สร้างเว็บแอปบัญชีรายรับ-รายจ่ายส่วนตัว (ภาษาไทย) ที่:
- บันทึกรายรับ/รายจ่ายพร้อมหมวดหมู่ วันที่ โน้ต
- สรุปยอดคงเหลือแบบ "สมุดบัญชี" (passbook style)
- ใช้งานได้จริงนอก Claude.ai ผ่านการ deploy เป็นเว็บของตัวเอง
- มีระบบฐานข้อมูลจริงรองรับหลายอุปกรณ์ / ผู้ใช้ล็อกอิน

## สถาปัตยกรรมที่ตัดสินใจแล้ว
- **Hosting**: GitHub Pages (โฮสต์ React app หลัง build เป็น static site, ฟรี)
- **Database + Auth**: Supabase (Postgres + Auth, เรียกตรงจาก browser ฝั่ง client)
- **โครงสร้าง**: ไม่มี backend server แยก — browser คุยกับ Supabase โดยตรง
```
Browser (มือถือ/คอม) ──→ GitHub Pages (เสิร์ฟหน้าเว็บ static)
                     └──→ Supabase (ฐานข้อมูล + Auth)
```
- หมายเหตุความปลอดภัย: `SUPABASE_ANON_KEY` จะติดไปกับไฟล์ static ที่ build (เป็นเรื่องปกติ) ความปลอดภัยจริงอยู่ที่ RLS policy ใน Phase 1 ไม่ใช่การซ่อน key

## สถานะปัจจุบัน
- ✅ ต้นแบบ UI: `expense-tracker.jsx` (React artifact) — พัฒนาต่อเนื่องหลายรอบ ปัจจุบันมีฟีเจอร์:
  - เก็บข้อมูลด้วย `window.storage` (เฉพาะภายใน Claude artifact เท่านั้น ใช้นอกระบบไม่ได้ — ต้องย้ายเป็น Supabase ใน Phase 1-4)
  - ธีม: สมุดบัญชี/พาสบุ๊ก โทนสี ink navy + gold + cream
  - Font: system font stack ทั้งเว็บ (`-apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Segoe UI', Roboto, sans-serif`) — เอา Courier New monospace ออกทั้งหมดแล้ว ใช้ font เดียวกันทุกจุดรวมตัวเลข
  - เพิ่ม/ลบรายการ, แยกหมวดรายรับ-รายจ่าย, สรุปยอดคงเหลือ, filter ตามประเภท (รายรับ/รายจ่าย/ทั้งหมด)
  - Responsive: จอกว้าง (≥800px) แบ่ง 2 คอลัมน์ (ฟอร์ม+สรุป ซ้าย / รายการ ขวา), จอแคบ/มือถือเรียงคอลัมน์เดียว
  - จัดกลุ่มรายการได้ 3 แบบ: รายวัน / รายเดือน / รายปี พร้อมยอดรวม +รับ/-จ่าย กำกับแต่ละกลุ่ม
  - **Filter ช่วงเวลาเจาะจง**: เลือกดูเฉพาะวัน/เดือน/ปีที่ต้องการได้ (dropdown ดึงจากข้อมูลจริงเท่านั้น) มีตัวเลือก "ทุกช่วงเวลา" เป็นค่าเริ่มต้น
  - สรุปตามหมวดหมู่แบบกราฟแท่ง + ตัวเลข เรียงมาก→น้อย สลับดูได้ทั้งฝั่งรายจ่าย/รายรับ
  - แก้ UI dropdown เลือกหมวดหมู่ให้ลูกศรไม่ชิดขอบ (custom arrow + padding สมดุล)
- ✅ Phase 1 เสร็จสมบูรณ์: โปรเจกต์ Supabase ชื่อ `BancheeBao` สร้างแล้ว (region Asia-Pacific)
  - ตาราง `entries` + RLS 4 policy (select/insert/update/delete own) รันสำเร็จ
  - Data API เปิดใช้งานแล้ว (เดิมปิดไว้ตอนสร้างโปรเจกต์ เพราะปิด "Automatically expose new tables" — ไปเปิดเพิ่มทีหลังใน Data API settings > exposed schemas: public)
  - Auth email/password เปิดใช้งานแล้ว (toggle เขียว)
  - Credentials เก็บแล้ว:
    - Project URL: `https://hvyubughedyxkhhuryik.supabase.co`
    - Publishable/anon key: ขึ้นต้น `sb_publishable_...` (key รุ่นใหม่ของ Supabase ใช้แทน anon key แบบ JWT เดิมได้ปกติ)
- ⬜ ยังไม่มี: repo GitHub, hosting
- ✅ Phase 2: โปรเจกต์ Vite + React (`bancheebao/`) พร้อม supabaseClient.js และ .env ค่าจริงแล้ว (ดูรายละเอียดในหัวข้อแผนงาน Phase 2 ด้านล่าง)

## แผนงาน 6 Phase (ยังไม่เริ่มทำ — รอคอนเฟิร์มทีละขั้น)

### Phase 1 — เตรียม Backend (Supabase) ✅ เสร็จแล้ว
- ✅ สร้างโปรเจกต์ Supabase ชื่อ `BancheeBao`
- ✅ ตาราง `entries` (id, user_id, type, amount, category, note, date, created_at) + RLS + 4 policy
- ✅ เปิด Data API (exposed schema: public)
- ✅ ตั้งค่า Auth email/password
- ✅ เก็บ Project URL + publishable/anon key แล้ว

### Phase 2 — ตั้งโปรเจกต์ฝั่งเว็บ ✅ เสร็จแล้ว
- ✅ สร้างโปรเจกต์ React ด้วย Vite (`bancheebao/`)
- ✅ ติดตั้ง `@supabase/supabase-js`, ตั้งค่า `.env` (ใส่ค่าจริง VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) + `.env.example` + `.gitignore`
- ✅ สร้าง `src/supabaseClient.js`
- ✅ ย้าย UI ต้นแบบเป็น `src/App.jsx` (ยังใช้ window.storage เดิม — ยังไม่เปลี่ยนเป็น Supabase จนกว่าจะถึง Phase 4)
- ✅ ทดสอบ `npm install` + `npm run build` ผ่านแล้ว ไม่มี error
- 📦 แพ็กเป็น `bancheebao-phase2.zip` ส่งให้แล้ว (ไม่รวม node_modules/dist — ต้อง `npm install` เองหลังแตกไฟล์)

### Phase 3 — Auth flow
- หน้า Login/Signup
- Session state ผ่าน `onAuthStateChange`
- Route guard สำหรับผู้ที่ยังไม่ล็อกอิน

### Phase 4 — ฟีเจอร์หลัก
- ย้าย UI จาก `expense-tracker.jsx` มาที่โปรเจกต์ React
- เปลี่ยน `window.storage` เป็น Supabase (`select` / `insert` / `delete`)
- ทดสอบ CRUD ครบวงจร

### Phase 5 — Polish
- Loading state / error handling (ยังไม่ทำ — รอทำตอนต่อ Supabase จริง เพราะตอนนี้ยังไม่มี network call)
- ✅ Responsive มือถือ+คอม (ทำแล้วในต้นแบบ)
- ✅ Sort/filter ตามวัน/เดือน/ปี, หมวดหมู่ (ทำแล้วในต้นแบบ)

### Phase 6 — Deploy
- Push โค้ดขึ้น GitHub repo
- ตั้งค่า GitHub Pages (เปิดใช้งานใน repo settings, เลือก branch/โฟลเดอร์ที่ build ออกมา)
- ตั้งค่า `base` path ใน Vite config ให้ตรงกับชื่อ repo (ข้อกำหนดเฉพาะของ GitHub Pages)
- ตั้งค่า GitHub Actions ให้ build+deploy อัตโนมัติทุกครั้งที่ push (auto-deploy)
- ใส่ environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) ผ่าน GitHub Actions secrets
- ทดสอบบน production URL จริง (รูปแบบ `username.github.io/repo-name`)

## หมายเหตุ: Key/URL กับปัญหา AI Secret Scanner
- `SUPABASE_URL` และ `anon/publishable key` (ขึ้นต้น `sb_publishable_...` หรือแบบ JWT เดิม) เป็นค่าที่ **ตั้งใจให้ฝังในโค้ด frontend ได้ปกติ** — ความปลอดภัยจริงอยู่ที่ RLS policy ไม่ใช่การซ่อน key (ดูหัวข้อสถาปัตยกรรมด้านบน)
- ห้ามใส่ `service_role` key ในโค้ด frontend เด็ดขาด — อันนั้นข้าม RLS ได้หมด เป็นตัวเดียวที่ต้องเก็บเป็นความลับจริง
- **ปัญหาที่อาจเจอ**: เครื่องมือ/AI บางตัวมี secret scanner อัตโนมัติ พอเจอ pattern คล้าย API key จะ block หรือปฏิเสธทำงานต่อทันที ทั้งที่เป็น public key ที่ปลอดภัย
- **วิธีแก้/ป้องกันไว้ก่อน**:
  1. เก็บ URL/anon key ใน `.env` แยกจากโค้ดเสมอ (แม้เป็น public key ก็ตาม เพราะ scanner ส่วนใหญ่เช็คจาก pattern ไม่สนบริบท)
  2. ใส่ `.env` ใน `.gitignore` ตั้งแต่ต้น (กันเผื่อมี key อื่นที่เป็นความลับจริงหลุดปนมาทีหลัง)
  3. ถ้าเครื่องมือ/AI ตัวไหน refuse เพราะเจอ key ให้ยืนยันตรง ๆ ว่า "นี่คือ Supabase anon/publishable key ตั้งใจ expose ฝั่ง client ได้ ปลอดภัยด้วย RLS" ส่วนใหญ่จะทำงานต่อได้
- Credentials ปัจจุบันของโปรเจกต์นี้ (ปลอดภัย ใส่ตรง ๆ ได้เลยทุกที่ที่ต้องใช้):
  - Project URL: `https://hvyubughedyxkhhuryik.supabase.co`
  - Publishable/anon key: ขึ้นต้น `sb_publishable_aJaBlZ65759Cqoh8_iZjHg_ZugZt7QL` (คีย์รุ่นใหม่ของ Supabase)


- RLS policy ผิด → ดึงข้อมูลไม่ได้ หรือ error "row violates policy"
- ลืมใส่ `user_id` ตอน insert
- `.env` ไม่ถูกโหลดใน production (ต้องตั้งเป็น GitHub Actions secret ด้วย ไม่ใช่แค่ไฟล์ local)
- Timezone ของ `date` เพี้ยนตอนบันทึก/แสดงผล
- GitHub Pages: ลืมตั้ง `base` path ใน Vite config → asset โหลดไม่ขึ้น (หน้าขาว/ 404) เพราะ repo ไม่ได้อยู่ที่ root domain
- GitHub Pages: routing แบบ client-side (ถ้ามีหลายหน้า) ต้องตั้งค่าพิเศษ ไม่งั้น refresh หน้าที่ไม่ใช่หน้าแรกจะขึ้น 404

## ไฟล์ที่เกี่ยวข้อง
- `/mnt/user-data/outputs/expense-tracker.jsx` — ต้นแบบ UI (Claude artifact, ใช้ window.storage)
- `/mnt/user-data/outputs/context.md` — ไฟล์นี้
- `/mnt/user-data/outputs/supabase_setup.sql` — SQL schema + RLS ที่รันไปแล้วใน Supabase SQL Editor (เก็บไว้อ้างอิง/rerun ถ้าต้องสร้างโปรเจกต์ใหม่)
- `/mnt/user-data/outputs/bancheebao-phase2.zip` — โปรเจกต์ Vite+React (Phase 2) แตกไฟล์แล้ว `npm install` ก่อนรัน `npm run dev`
