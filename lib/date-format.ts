const BANGKOK_TIME_ZONE = "Asia/Bangkok";

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
