import { getStatusThaiLabel, type CheckinStatus } from "@/lib/checkin-status";

export type ExportCheckinStatus = Exclude<CheckinStatus, "TOO_EARLY">;

export type ExportCheckinRecord = {
  id: string;
  roundId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  assigneeEmail: string;
  status: ExportCheckinStatus;
  statusLabelTh: string;
  checkedInAt: string | null;
  latitude: number | null;
  longitude: number | null;
  mapLink: string | null;
};

export const EXPORT_RANGE_PRESETS = [7, 14, 30] as const;
export const EXPORT_MAX_RANGE_DAYS = 30;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toISODate(value: Date) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

export function getLatestDateRange(days: number, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(end.getDate() - (days - 1));

  return {
    startDate: toISODate(start),
    endDate: toISODate(end)
  };
}

export function getInclusiveDateRangeDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000+07:00`);
  const end = new Date(`${endDate}T00:00:00.000+07:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function validateExportDateRange(startDate: string, endDate: string) {
  const days = getInclusiveDateRangeDays(startDate, endDate);

  if (!days || days < 1) {
    return { ok: false as const, error: "กรุณาเลือกช่วงวันที่ให้ถูกต้อง" };
  }

  if (days > EXPORT_MAX_RANGE_DAYS) {
    return { ok: false as const, error: "เลือกช่วงวันที่ได้สูงสุด 30 วัน" };
  }

  return { ok: true as const, days };
}

export function getExportStatusThaiLabel(status: ExportCheckinStatus) {
  return getStatusThaiLabel(status);
}

export function escapeCsvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  const safeValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;

  if (/[",\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  return safeValue;
}

export function createCheckinCsv(records: ExportCheckinRecord[]) {
  const headers = [
    "round_id",
    "title",
    "description",
    "start_at",
    "end_at",
    "assignee_email",
    "status",
    "status_label_th",
    "checked_in_at",
    "latitude",
    "longitude",
    "map_link"
  ];

  const rows = records.map((record) => [
    record.roundId,
    record.title,
    record.description,
    record.startAt,
    record.endAt,
    record.assigneeEmail,
    record.status,
    record.statusLabelTh,
    record.checkedInAt,
    record.latitude,
    record.longitude,
    record.mapLink
  ]);

  const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  return `\uFEFF${csv}`;
}
