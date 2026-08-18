# Abstract Hero AR V6 — 60 FPS + Hand Skeleton + Floating AR Answers

## สิ่งที่เปลี่ยนจาก V5

### 1. คำตอบลอยแบบ AR
- SOLO แบบ Swipe: คำตอบซ้าย/ขวาแยกออกจากการ์ดกลางและลอยคนละจังหวะ
- เพิ่ม Hologram glow, blur และ depth เพื่อไม่ให้เหมือนปุ่ม UI ธรรมดา
- MCQ แต่ละคำตอบเป็น Floating AR card
- VS 2 Players คำตอบของแต่ละฝั่งลอยแยกกัน
- Mobile จะกลับมาเรียงเป็นปุ่มเพื่อไม่ให้ล้นจอ

### 2. Hand Skeleton กลับมาแล้ว
- ใช้ landmark 21 จุดของ MediaPipe
- วาดกระดูกและข้อต่อด้วย Canvas Overlay
- P1 ใช้โทน cyan / P2 ใช้โทน purple
- มือที่สองของผู้เล่นเดียวกันแสดงจางกว่า เพื่อใช้ Two-Hand Power
- จุดนิ้วโป้งและนิ้วชี้เด่นขึ้น ช่วยดู Pinch ได้ง่าย
- ใช้ Canvas แทนการสร้าง DOM/SVG จำนวนมากทุกเฟรมเพื่อลดโหลด

### 3. 60 FPS / ลดความหน่วง
- ขอ Camera 1280x720 @ 60 FPS
- ตั้ง video contentHint เป็น motion เมื่อ Browser รองรับ
- Hand Skeleton/UI render ด้วย requestAnimationFrame ~60 FPS
- MediaPipe inference ใช้ Adaptive 30–50 FPS โดยดูเวลาประมวลผลจริง
- ถ้าบังคับ MediaPipe 60 inference/sec บนอุปกรณ์ที่ช้า จะทำให้ main thread หน่วงกว่าเดิม จึงไม่ทำแบบนั้น
- หน้าจอจะแสดง FPS จริงที่กล้องอนุญาต เช่น `60 FPS CAM / 60 FPS RENDER`

### 4. Gesture Engine V6
- EMA ตอบสนองเร็วกว่า V5
- Pinch engage/release 2 เฟรม
- Pinch → Fist ยืนยันเร็วขึ้น
- Swipe threshold ประมาณ 0.72 ฝ่ามือ และมี minimum แบบ adaptive
- ลด cooldown/re-arm delay
- ยังคง Horizontal dominance + velocity + monotonic direction เพื่อกัน false swipe
- VS ยังคง Player Ownership + Safe Zone + Two Hands ต้องเป็นของคนเดียวกัน

### 5. Question Builder
ระบบ V5 ยังอยู่ครบ:
- เพิ่ม / แก้ / ลบคำถาม
- Swipe 2 คำตอบ
- Multiple Choice 2–6 คำตอบ
- เพิ่มข้อความคำตอบเอง
- Import / Export JSON

## วิธีอัป GitHub Pages
สำหรับ Repository ที่ `index.html` อยู่ root แบบของคุณ:

1. สำรอง/Commit เวอร์ชันปัจจุบันไว้ก่อน
2. อัป `index.html` V6 ทับ `index.html` เดิม
3. ถ้าต้องการเก็บ Source ให้ทับ `page.tsx` และ `globals.css` ด้วย
4. สามารถอัป `package.json`, `vite.config.ts`, `tsconfig.json` ทับได้ (dependencies เดิม)
5. Commit
6. รอ GitHub Pages deployment เป็นสีเขียว
7. กด `Ctrl + F5`

## หมายเหตุเรื่อง 60 FPS
ระบบจะขอ 60 FPS แต่ FPS จริงขึ้นอยู่กับ Webcam, Browser, แสง และเครื่องที่ใช้ ถ้ากล้องรองรับเพียง 30 FPS ระบบจะแสดงค่าจริง ไม่ปลอมเป็น 60 FPS ส่วน Skeleton/UI ยังใช้ render loop 60 FPS พร้อม interpolation เพื่อให้การเคลื่อนไหวลื่นที่สุดเท่าที่เครื่องทำได้
