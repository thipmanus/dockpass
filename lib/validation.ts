import { parseEmailList } from "@/lib/email";
import { isValidShipCode, normalizeShipCode } from "@/lib/ship-code";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_REMARK_LENGTH = 250;
const MAX_ASSIGNED_EMAILS = 200;
const MAX_TIME_RULE_MINUTES = 1440;
const MAX_SHIP_DURATION_MS = 24 * 60 * 60 * 1000;

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

export function isValidDateTime(value: string) {
  const timestamp = new Date(value).getTime();
  return Boolean(value) && Number.isFinite(timestamp);
}

export function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

function validateLocationPayload(input: Record<string, unknown>) {
  const lat = typeof input.lat === "number" ? input.lat : null;
  const lng = typeof input.lng === "number" ? input.lng : null;
  const accuracy = typeof input.accuracy === "number" ? input.accuracy : null;
  const clientCapturedAt =
    typeof input.client_captured_at === "string" && isValidDateTime(input.client_captured_at)
      ? input.client_captured_at
      : null;

  if (
    lat === null ||
    lng === null ||
    accuracy === null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    accuracy < 0 ||
    accuracy > 10_000
  ) {
    return { ok: false as const, error: "กรุณาอนุญาตตำแหน่งและกรอกข้อมูลให้ครบถ้วน" };
  }

  return { ok: true as const, lat, lng, accuracy, clientCapturedAt };
}

export function validatePublicVerifyPayload(payload: unknown) {
  const input = payload as Record<string, unknown> | null;
  const email = String(input?.email ?? "").trim().toLowerCase();
  const code = normalizeShipCode(String(input?.code ?? ""));

  if (!isValidEmail(email) || !isValidShipCode(code)) {
    return { ok: false as const };
  }

  return { ok: true as const, email, code };
}

export function validateCheckinPayload(payload: unknown) {
  const base = validatePublicVerifyPayload(payload);
  if (!base.ok) {
    return { ok: false as const, error: "อีเมลหรือรหัสรอบไม่ถูกต้อง" };
  }

  const location = validateLocationPayload(payload as Record<string, unknown>);
  if (!location.ok) {
    return location;
  }

  return {
    ok: true as const,
    email: base.email,
    code: base.code,
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy,
    clientCapturedAt: location.clientCapturedAt
  };
}

export function validateCreateShipPayload(payload: unknown) {
  const input = payload as Record<string, unknown> | null;
  const title = String(input?.title ?? input?.name ?? "").trim();
  const description = String(input?.description ?? "").trim();
  const remarkValue = String(input?.remark ?? "").trim();
  const remark = remarkValue.length > 0 ? remarkValue : null;
  const startAt = String(input?.start_at ?? "");
  const endAt = String(input?.end_at ?? "");
  const assignedEmails = parseEmailList(String(input?.assigned_emails ?? ""));
  const earlyCheckinMinutes = Number(input?.early_checkin_minutes ?? 5);
  const onTimeUntilMinutes = Number(input?.on_time_until_minutes ?? 10);
  const closeBeforeEndMinutes = Number(input?.close_before_end_minutes ?? 5);

  if (
    !title ||
    title.length > MAX_TITLE_LENGTH ||
    !description ||
    description.length > MAX_DESCRIPTION_LENGTH ||
    (remark !== null && remark.length > MAX_REMARK_LENGTH) ||
    !isValidDateTime(startAt) ||
    !isValidDateTime(endAt) ||
    assignedEmails.length === 0
  ) {
    return { ok: false as const, error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  if (assignedEmails.length > MAX_ASSIGNED_EMAILS) {
    return { ok: false as const, error: "เพิ่มผู้ได้รับมอบหมายได้สูงสุด 200 อีเมลต่อรอบเช็กอิน" };
  }

  if (assignedEmails.some((email) => !isValidEmail(email))) {
    return { ok: false as const, error: "รูปแบบอีเมลผู้ได้รับมอบหมายไม่ถูกต้อง" };
  }

  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();

  if (startTime >= endTime) {
    return { ok: false as const, error: "เวลาเริ่มต้องมาก่อนเวลาสิ้นสุด" };
  }

  if (endTime - startTime > MAX_SHIP_DURATION_MS) {
    return { ok: false as const, error: "หนึ่งรอบเช็กอินต้องมีระยะเวลาไม่เกิน 24 ชั่วโมง" };
  }

  if (
    !isNonNegativeInteger(earlyCheckinMinutes) ||
    !isNonNegativeInteger(onTimeUntilMinutes) ||
    !isNonNegativeInteger(closeBeforeEndMinutes) ||
    earlyCheckinMinutes > MAX_TIME_RULE_MINUTES ||
    onTimeUntilMinutes > MAX_TIME_RULE_MINUTES ||
    closeBeforeEndMinutes > MAX_TIME_RULE_MINUTES
  ) {
    return { ok: false as const, error: "กฎเวลาต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ถึง 1440 นาที" };
  }

  return {
    ok: true as const,
    title,
    description,
    remark,
    startAt,
    endAt,
    assignedEmails,
    earlyCheckinMinutes,
    onTimeUntilMinutes,
    closeBeforeEndMinutes
  };
}

export function validateUserCheckinPayload(payload: unknown) {
  const input = payload as Record<string, unknown> | null;
  const shipId = String(input?.ship_id ?? "").trim();

  if (!UUID_PATTERN.test(shipId)) {
    return { ok: false as const, error: "รอบเช็กอินไม่ถูกต้อง" };
  }

  const location = validateLocationPayload((input ?? {}) as Record<string, unknown>);
  if (!location.ok) {
    return location;
  }

  return {
    ok: true as const,
    shipId,
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy,
    clientCapturedAt: location.clientCapturedAt
  };
}
