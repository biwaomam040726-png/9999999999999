# Abstract Hero AR V5 — Stable Hand AI + Floating Answers + Question Builder

## อัป GitHub Pages
Repository ของคุณใช้ไฟล์ที่ root ให้แตก ZIP แล้วอัปทับไฟล์เดิม โดยเฉพาะ `index.html`

ไฟล์หลัก:
- `index.html` — เวอร์ชัน standalone เปิดผ่าน GitHub Pages ได้ทันที
- `page.tsx` — source สำหรับแก้ต่อ
- `globals.css` — UI / animation
- `package.json`, `vite.config.ts`, `tsconfig.json` — สำหรับพัฒนา/Build ด้วย Vite

## V5 เพิ่มอะไร
1. การ์ดคำถามลอยแบบ AR และมี glow/aura
2. ปุ่มคำตอบลอยคนละจังหวะ ไม่ดูนิ่ง
3. ตอบแล้วมี motion ซ้าย/ขวา, correct glow, wrong shake และคะแนนลอย
4. Multiple Choice มีคำตอบลอย 2–6 ตัวเลือก
5. MCQ ใช้ Swipe ซ้าย/ขวาเพื่อเลื่อนคำตอบ และ Pinch → Fist เพื่อยืนยัน
6. Gesture Engine ลด threshold Swipe แต่เพิ่ม monotonic direction check ทำให้ปัดง่ายขึ้นโดยลด false trigger
7. เพิ่ม jump rejection + adaptive EMA smoothing + velocity tracking
8. Player Lock ต้องเห็นมือเสถียรหลายเฟรมก่อน Lock
9. โหมด VS ยังใช้ ownership / Safe Zone / two-hand power ของคนเดียวกัน
10. Teacher > คลังคำถาม เพิ่ม/แก้/ลบคำถามเองได้
11. คำถามแบบ Swipe ปรับข้อความคำตอบซ้าย/ขวาและเฉลยได้เอง
12. คำถามแบบ Multiple Choice เพิ่ม/ลบคำตอบ 2–6 ตัวเลือกและเลือกเฉลยได้เอง
13. Question Bank บันทึกอัตโนมัติใน localStorage
14. Import / Export Question Bank เป็น JSON
15. ถ้าด่านใดไม่มีคำถาม เกมจะข้ามด่านนั้นอัตโนมัติ

## วิธีใช้ Multiple Choice ด้วยมือ
- ปัดซ้าย: เลื่อนไปคำตอบก่อนหน้า
- ปัดขวา: เลื่อนไปคำตอบถัดไป
- จีบนิ้ว แล้วกำมือ: ยืนยันคำตอบที่กำลังไฮไลต์

## ถ้าอัปแล้วเว็บยังเป็นของเก่า
รอ GitHub Pages Deploy ให้เสร็จ แล้วกด `Ctrl + F5`
