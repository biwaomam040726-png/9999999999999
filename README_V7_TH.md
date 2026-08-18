Abstract Hero AR V7 (Quick Fix)

สิ่งที่ปรับจาก V6
- ปรับ Gesture Engine ให้ปัดติดง่ายขึ้นมาก:
  - ลด min hand confidence เป็น 0.35
  - ลด swipe threshold เป็นประมาณ 0.5 เท่าความกว้างฝ่ามือ
  - ขยายหน้าต่างเก็บ trail เป็น 700ms
  - ลด cooldown/re-arm ให้ตอบสนองเร็วขึ้น
  - ลดเงื่อนไข monotonic / velocity / horizontal dominance ให้เหมาะกับการใช้งานจริง
  - ขยายพื้นที่ที่ถือว่า act ได้ในโหมดเล่นจริง
- ปรับ Answer UI:
  - การ์ดคำตอบลอยแรงขึ้น เด้งมากขึ้น
  - ซ่อนข้อความเล็ก ๆ ที่รกตา เช่น SWIPE LEFT / SWIPE RIGHT และ pinch cue ด้านล่างการ์ด
- ระบบเพิ่มคำถาม/คำตอบของ V5/V6 ยังคงอยู่

ไฟล์สำคัญที่สุดสำหรับ GitHub Pages
- index.html

ถ้าจะอัปเร็วที่สุด:
1) อัป index.html ทับไฟล์เดิมที่ root ของ repository
2) Commit
3) รอ GitHub Pages deploy
4) กด Ctrl + F5
