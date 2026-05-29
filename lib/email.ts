export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseEmailList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map(normalizeEmail)
        .filter(Boolean)
    )
  );
}

export function createInvitePreview(params: {
  shipName: string;
  code: string;
  checkInLink: string;
}) {
  return `สวัสดีค่ะ/ครับ\n\nคุณได้รับสิทธิ์เช็กอินสำหรับ ${params.shipName}\nรหัสรอบ: ${params.code}\nลิงก์เช็กอิน: ${params.checkInLink}\n\nหมายเหตุ: MVP นี้ยังไม่ส่งอีเมลจริง กรุณาคัดลอกข้อความนี้เพื่อส่งต่อเอง`;
}
