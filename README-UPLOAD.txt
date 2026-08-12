วิธีแก้หน้าขาวบน GitHub Pages

1. แตกไฟล์ ZIP นี้
2. เปิดโฟลเดอร์ Abstract-Hero-AR-STATIC-UPLOAD
3. อัปโหลด index.html และโฟลเดอร์ assets ไปไว้หน้าแรกของ Repository
4. ถ้ามี index.html เดิม ให้เลือก Commit changes เพื่อเขียนทับ
5. ไปที่ Settings > Pages
6. ตั้ง Source เป็น Deploy from a branch, Branch เป็น main และ Folder เป็น /(root)
7. รอประมาณ 1-3 นาที แล้วกด Ctrl+Shift+R ที่หน้าเกม

ไฟล์ชุดนี้ผ่านการ build แล้ว จึงใช้กับ Deploy from a branch ได้โดยตรง
ไม่ต้องรัน npm install และไม่จำเป็นต้องอัปโหลดโฟลเดอร์ src
