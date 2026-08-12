# Abstract Hero AR — GitHub Pages

เกม Camera AR ภาษาไทยสำหรับเรียนรู้แนวคิดเชิงนามธรรม ผู้เล่นใช้มือจริงหน้ากล้องเพื่อจำแนกข้อมูล

## ทดลองบนเครื่อง

    npm install
    npm run dev

เปิด URL ที่ Vite แสดง จากนั้นกด “เปิดกล้องและเริ่ม AR” และเลือก Allow

## อัปขึ้น GitHub Pages

1. สร้าง Repository ใหม่
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ โดยต้องอัปโฟลเดอร์ .github ด้วย
3. ไปที่ Settings → Pages
4. เลือก Source เป็น GitHub Actions
5. ไปที่ Actions แล้วรอ Deploy Abstract Hero AR ทำงานเสร็จ
6. เปิดลิงก์ https://ชื่อผู้ใช้.github.io/ชื่อ-repository/
7. กดเปิดกล้องและเลือก Allow

## สำคัญ

- GitHub Pages เป็น HTTPS จึงใช้งานกล้องได้
- ห้ามเปิด index.html ด้วยการดับเบิลคลิก เพราะกล้องต้องใช้ HTTPS หรือ localhost
- หากเปิดเว็บในหน้าพรีวิว/iframe แล้วกล้องไม่ทำงาน ให้เปิดลิงก์ในแท็บใหม่
- iPhone รองรับ Camera AR + Hand Tracking แต่อาจไม่รองรับ WebXR Immersive
- เมาส์เป็นโหมดช่วยเหลือเท่านั้น เมื่อ Hand Tracking ทำงาน ปุ่มเมาส์จะถูกล็อกไว้เป็นค่าเริ่มต้น

ภาพกล้องประมวลผลบนอุปกรณ์และไม่ถูกบันทึกหรืออัปโหลด
