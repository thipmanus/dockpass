import type { CheckinStatus } from "@/lib/checkin-status";

const ONE_HOUR_MS = 60 * 60 * 1000;
const HISTORY_VISIBLE_MS = 72 * ONE_HOUR_MS;
const HISTORY_TOTAL_MS = ONE_HOUR_MS + HISTORY_VISIBLE_MS;
const CHECKIN_CLOSED_REASON = "รอบเช็กอินนี้หมดเวลาการเช็กอินแล้ว";

export function getCheckinOpenAt(params: {
  startAt: string | Date;
  earlyCheckinMinutes: number;
}) {
  return new Date(new Date(params.startAt).getTime() - params.earlyCheckinMinutes * 60_000);
}

export function isWithinThaiDate(value: string | Date, date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date(value)) === formatter.format(date);
}

export function getHistoryState(params: { now: Date; endAt: string | Date }) {
  const endAt = new Date(params.endAt).getTime();
  const historyStartsAt = endAt + ONE_HOUR_MS;
  const historyExpiresAt = endAt + HISTORY_TOTAL_MS;
  const now = params.now.getTime();

  return {
    isHistory: now > historyStartsAt && now <= historyExpiresAt,
    isTrashEligible: now > historyExpiresAt,
    isExpiredFromHistory: now > historyExpiresAt,
    historyStartsAt: new Date(historyStartsAt),
    historyExpiresAt: new Date(historyExpiresAt)
  };
}

export function isHistoryShip(now: Date, endAt: string | Date) {
  return getHistoryState({ now, endAt }).isHistory;
}

export function isTrashEligibleShip(now: Date, endAt: string | Date) {
  return getHistoryState({ now, endAt }).isTrashEligible;
}

export function getTrashCutoff(now = new Date()) {
  return new Date(now.getTime() - HISTORY_TOTAL_MS);
}

export function canCheckInShip(params: {
  now: Date;
  startAt: string | Date;
  endAt: string | Date;
  earlyCheckinMinutes: number;
  checkedIn: boolean;
}) {
  if (params.checkedIn) {
    return { canCheckIn: false, disabledReason: "เช็กอินแล้ว" };
  }

  const history = getHistoryState({ now: params.now, endAt: params.endAt });
  if (history.isTrashEligible) {
    return { canCheckIn: false, disabledReason: CHECKIN_CLOSED_REASON };
  }

  if (history.isHistory) {
    return { canCheckIn: false, disabledReason: CHECKIN_CLOSED_REASON };
  }

  const openAt = getCheckinOpenAt({
    startAt: params.startAt,
    earlyCheckinMinutes: params.earlyCheckinMinutes
  });

  if (params.now.getTime() < openAt.getTime()) {
    return { canCheckIn: false, disabledReason: "ยังไม่ถึงเวลาเช็กอิน" };
  }

  return { canCheckIn: true, disabledReason: null };
}

export function getUserShipState(params: {
  now: Date;
  startAt: string | Date;
  endAt: string | Date;
  earlyCheckinMinutes: number;
  status: CheckinStatus;
}) {
  const openAt = getCheckinOpenAt({
    startAt: params.startAt,
    earlyCheckinMinutes: params.earlyCheckinMinutes
  });
  const history = getHistoryState({ now: params.now, endAt: params.endAt });
  const availability = canCheckInShip({
    now: params.now,
    startAt: params.startAt,
    endAt: params.endAt,
    earlyCheckinMinutes: params.earlyCheckinMinutes,
    checkedIn: params.status !== "NOT_CHECKED_IN"
  });

  if (history.isTrashEligible) {
    return {
      canCheckIn: false,
      disabledReason: availability.disabledReason,
      isHistory: false,
      isExpiredFromHistory: true,
      isTrashEligible: true,
      checkinOpenAt: openAt
    };
  }

  if (history.isHistory) {
    return {
      canCheckIn: false,
      disabledReason: availability.disabledReason,
      isHistory: true,
      isExpiredFromHistory: false,
      isTrashEligible: false,
      checkinOpenAt: openAt
    };
  }

  if (!availability.canCheckIn) {
    return {
      canCheckIn: false,
      disabledReason: availability.disabledReason,
      isHistory: false,
      isExpiredFromHistory: false,
      isTrashEligible: false,
      checkinOpenAt: openAt
    };
  }

  return {
    canCheckIn: true,
    disabledReason: null,
    isHistory: false,
    isExpiredFromHistory: false,
    isTrashEligible: false,
    checkinOpenAt: openAt
  };
}
