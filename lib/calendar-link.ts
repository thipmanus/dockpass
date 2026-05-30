type GoogleCalendarLinkInput = {
  title: string;
  description: string;
  startAt: string | Date;
  endAt: string | Date;
  checkinUrl: string;
  remark?: string | null;
};

function toGoogleUtcDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function createGoogleCalendarLink(input: GoogleCalendarLinkInput) {
  const start = toGoogleUtcDate(input.startAt);
  const end = toGoogleUtcDate(input.endAt);

  if (!start || !end) {
    return null;
  }

  const details = [
    `รอบเช็กอิน: ${input.title}`,
    "",
    "รายละเอียด:",
    input.description,
    ...(input.remark?.trim() ? ["", "หมายเหตุ:", input.remark.trim()] : []),
    "",
    "เช็กอินที่:",
    input.checkinUrl,
    "",
    "กรุณาเข้าสู่ระบบด้วยอีเมลเดียวกับที่ได้รับมอบหมาย"
  ].join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `DockPass: ${input.title}`,
    dates: `${start}/${end}`,
    details,
    location: "DockPass"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getAppUrl(requestUrl?: string) {
  const fallbackUrl = requestUrl ? new URL(requestUrl).origin : "http://localhost:3000";
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || fallbackUrl;
}
