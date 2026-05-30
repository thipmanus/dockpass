const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const DATE_DISPLAY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DATE_TIME_DISPLAY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidDateParts(day: number, month: number, year: number) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return false;
  }

  if (year < 1000 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function getBangkokDateParts(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BANGKOK_TIME_ZONE
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = Number(get("year"));

  return {
    day: get("day") ?? "00",
    month: get("month") ?? "00",
    year: Number.isFinite(year) ? String(year + 543) : "0000",
    hour: get("hour") ?? "00",
    minute: get("minute") ?? "00"
  };
}

export function formatThaiDateDisplay(value: string | Date | null | undefined) {
  const parts = getBangkokDateParts(value);
  if (!parts) {
    return "-";
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatThaiTimeDisplay(value: string | Date | null | undefined) {
  const parts = getBangkokDateParts(value);
  if (!parts) {
    return "-";
  }

  return `${parts.hour}:${parts.minute}`;
}

export function formatThaiDateTimeDisplay(value: string | Date | null | undefined) {
  const parts = getBangkokDateParts(value);
  if (!parts) {
    return "-";
  }

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatThaiDateRangeDisplay(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
) {
  return `${formatThaiDateTimeDisplay(start)} - ${formatThaiDateTimeDisplay(end)}`;
}

export function formatDateDDMMYYYY(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function formatDateTimeDDMMYYYYHHmm(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return "";
  }

  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function parseDDMMYYYYToISODate(value: string) {
  const match = DATE_DISPLAY_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (!isValidDateParts(day, month, year)) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDDMMYYYYHHmmToLocalDateTime(value: string) {
  const match = DATE_TIME_DISPLAY_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (!isValidDateParts(day, month, year) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}
