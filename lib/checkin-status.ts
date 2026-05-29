export const CHECKIN_STATUSES = [
  "ON_TIME",
  "LATE",
  "NOT_CHECKED_IN",
  "OUT_OF_SHIP",
  "TOO_EARLY"
] as const;

export type CheckinStatus = (typeof CHECKIN_STATUSES)[number];

export function calculateCheckinStatus(params: {
  serverTime: Date;
  startAt: string | Date;
  endAt: string | Date;
  earlyCheckinMinutes: number;
  onTimeUntilMinutes: number;
  closeBeforeEndMinutes: number;
}): Exclude<CheckinStatus, "NOT_CHECKED_IN"> {
  const serverTime = params.serverTime.getTime();
  const startAt = new Date(params.startAt).getTime();
  const endAt = new Date(params.endAt).getTime();
  const earlyStart = startAt - params.earlyCheckinMinutes * 60_000;
  const onTimeEnd = startAt + params.onTimeUntilMinutes * 60_000;
  const closeAt = endAt - params.closeBeforeEndMinutes * 60_000;

  if (serverTime < earlyStart) {
    return "TOO_EARLY";
  }

  if (serverTime <= onTimeEnd) {
    return "ON_TIME";
  }

  if (serverTime <= closeAt) {
    return "LATE";
  }

  return "OUT_OF_SHIP";
}

export function getStatusThaiLabel(status: CheckinStatus) {
  const labels: Record<CheckinStatus, string> = {
    ON_TIME: "ตรงเวลา",
    LATE: "สาย",
    NOT_CHECKED_IN: "ยังไม่เช็กอิน",
    OUT_OF_SHIP: "นอกรอบ",
    TOO_EARLY: "เร็วเกินไป"
  };
  return labels[status];
}

export function getStatusBadgeVariant(status: CheckinStatus) {
  const variants: Record<CheckinStatus, "green" | "orange" | "gray" | "red" | "blue"> = {
    ON_TIME: "green",
    LATE: "orange",
    NOT_CHECKED_IN: "gray",
    OUT_OF_SHIP: "red",
    TOO_EARLY: "blue"
  };
  return variants[status];
}
