# Abstract Hero AR

เกม WebAR เพื่อการเรียนรู้เรื่องแนวคิดเชิงนามธรรม (Abstraction) สำหรับนักเรียนระดับมัธยมศึกษาตอนต้น

## ความสามารถหลัก

- บทเรียน 5 ด่าน พร้อมโจทย์สุ่มและบอส Chaos AI
- การจำแนกข้อมูลสำคัญ/ไม่สำคัญ พร้อมอธิบายเหตุผลทุกข้อ
- MediaPipe Hand Tracking: Open Palm, Pinch, Grab, Swipe, Raise Hand และ Two Hands
- Camera AR และ WebXR immersive-ar บนอุปกรณ์ที่รองรับ
- รองรับการสัมผัส เมาส์ และคีย์บอร์ด (ลูกศรซ้าย/ขวา, P, Space)
- Three.js hologram, GSAP feedback animations และเสียง Sci-Fi
- ระบบคะแนน Combo, adaptive timer, special power และ achievements
- ภาษาไทย เสียงบรรยาย ตัวอักษรใหญ่ และโหมดแยกสี
- ใบประกาศผล แดชบอร์ดครู รายงานในเครื่อง Export CSV และ Google Sheets

## เริ่มพัฒนา

```bash
npm install
npm run dev
```

การใช้กล้องและ WebXR ต้องเปิดผ่าน HTTPS หรือ localhost และผู้ใช้ต้องอนุญาตสิทธิ์กล้อง

## โครงสร้างสำคัญ

- `app/page.tsx` — เนื้อหาเกม ตรรกะการเล่น กล้อง ท่ามือ WebXR และรายงาน
- `app/globals.css` — งานภาพ responsive glassmorphism และ accessibility
- `app/layout.tsx` — metadata และ viewport

ข้อมูลรายงานผู้เรียนบันทึกใน Local Storage ของเบราว์เซอร์เท่านั้น ภาพกล้องไม่ถูกบันทึก
