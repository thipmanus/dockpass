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

type InviteTextParams = {
  title: string;
  description: string;
  remark?: string | null;
  checkInLink: string;
  calendarLink: string | null;
};

function createInviteText(params: InviteTextParams) {
  return [
    "สวัสดีค่ะ/ครับ",
    "",
    `คุณได้รับสิทธิ์เช็กอินสำหรับ ${params.title}`,
    "",
    "รายละเอียด:",
    params.description,
    ...(params.remark?.trim() ? ["", "หมายเหตุ:", params.remark.trim()] : []),
    "",
    `เปิดหน้าเช็กอิน: ${params.checkInLink}`,
    params.calendarLink ? `เพิ่มลง Google Calendar: ${params.calendarLink}` : null,
    "",
    "กรุณาเข้าสู่ระบบด้วยอีเมลเดียวกับที่ได้รับมอบหมาย"
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function createInviteEmailText(params: InviteTextParams) {
  return createInviteText(params);
}

export function createInvitePreview(params: InviteTextParams) {
  return [
    createInviteText(params),
    "",
    "หมายเหตุ: หากยังไม่ได้เปิดการส่งอีเมล กรุณาคัดลอกข้อความนี้เพื่อส่งต่อเอง"
  ].join("\n");
}
