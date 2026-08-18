Abstract Hero AR V22

แก้ระบบมือ VS ใหม่ทั้ง classifier

- เปลี่ยนจาก trail/min-max เป็น Anchor Swipe Detector แยก P1/P2
- ใช้พิกัดมือแบบ raw mirrored สำหรับ gesture แต่ skeleton ยัง smooth
- ต้องเคลื่อนประมาณ 1 ฝ่ามือจึงตอบ ไม่ใช่ขยับเล็กน้อย
- อนุญาตให้มือเข้าใกล้กึ่งกลางได้มากขึ้นโดยไม่ถูก block เพราะ ownership ถูก lock แล้ว
- re-arm ของ VS แยกจาก Solo และไม่ติด neutral gate เดิม
- ระหว่างปัดขึ้นสถานะ 25% / 50% / 75% ใต้ชื่อผู้เล่น เพื่อดูว่าระบบกำลังจับ Swipe จริง
- Solo ยังใช้ classifier เดิม ไม่เปลี่ยนพฤติกรรม
