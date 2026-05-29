import { describe, expect, it } from "vitest";
import {
  canCheckInShip,
  getHistoryState,
  getTrashCutoff,
  getUserShipState,
  isHistoryShip,
  isTrashEligibleShip
} from "./user-ship-state";

const ship = {
  startAt: "2026-05-29T08:00:00.000Z",
  endAt: "2026-05-29T09:00:00.000Z",
  earlyCheckinMinutes: 5
};

describe("history state", () => {
  it("is not history before end_at + 1 hour", () => {
    expect(getHistoryState({ now: new Date("2026-05-29T09:59:59.000Z"), endAt: ship.endAt }).isHistory).toBe(false);
  });

  it("is history after end_at + 1 hour", () => {
    expect(getHistoryState({ now: new Date("2026-05-29T10:00:01.000Z"), endAt: ship.endAt }).isHistory).toBe(true);
    expect(isHistoryShip(new Date("2026-05-29T10:00:01.000Z"), ship.endAt)).toBe(true);
  });

  it("is still history until end_at + 73 hours", () => {
    const state = getHistoryState({ now: new Date("2026-06-01T10:00:00.000Z"), endAt: ship.endAt });
    expect(state.isHistory).toBe(true);
    expect(state.isTrashEligible).toBe(false);
  });

  it("is trash eligible after end_at + 73 hours", () => {
    const state = getHistoryState({ now: new Date("2026-06-01T10:00:01.000Z"), endAt: ship.endAt });
    expect(state.isHistory).toBe(false);
    expect(state.isTrashEligible).toBe(true);
    expect(state.isExpiredFromHistory).toBe(true);
    expect(isTrashEligibleShip(new Date("2026-06-01T10:00:01.000Z"), ship.endAt)).toBe(true);
  });

  it("creates a trash cutoff at now minus 73 hours", () => {
    expect(getTrashCutoff(new Date("2026-06-01T10:00:00.000Z")).toISOString()).toBe(
      "2026-05-29T09:00:00.000Z"
    );
  });
});

describe("user ship availability", () => {
  it("is disabled before start_at - early_checkin_minutes", () => {
    const state = getUserShipState({
      ...ship,
      now: new Date("2026-05-29T07:54:59.000Z"),
      status: "NOT_CHECKED_IN"
    });

    expect(state.canCheckIn).toBe(false);
    expect(state.disabledReason).toBe("ยังไม่ถึงเวลาเช็กอิน");
  });

  it("is enabled at start_at - early_checkin_minutes", () => {
    const state = getUserShipState({
      ...ship,
      now: new Date("2026-05-29T07:55:00.000Z"),
      status: "NOT_CHECKED_IN"
    });

    expect(state.canCheckIn).toBe(true);
  });

  it("is enabled during the on-time and late windows", () => {
    expect(
      getUserShipState({
        ...ship,
        now: new Date("2026-05-29T08:05:00.000Z"),
        status: "NOT_CHECKED_IN"
      }).canCheckIn
    ).toBe(true);
    expect(
      getUserShipState({
        ...ship,
        now: new Date("2026-05-29T08:30:00.000Z"),
        status: "NOT_CHECKED_IN"
      }).canCheckIn
    ).toBe(true);
  });

  it("is enabled during the OUT_OF_SHIP window through end_at + 1 hour", () => {
    expect(
      getUserShipState({
        ...ship,
        now: new Date("2026-05-29T08:55:01.000Z"),
        status: "NOT_CHECKED_IN"
      }).canCheckIn
    ).toBe(true);
    expect(
      getUserShipState({
        ...ship,
        now: new Date("2026-05-29T10:00:00.000Z"),
        status: "NOT_CHECKED_IN"
      }).canCheckIn
    ).toBe(true);
  });

  it("is disabled after a check-in exists", () => {
    const state = getUserShipState({
      ...ship,
      now: new Date("2026-05-29T08:00:00.000Z"),
      status: "ON_TIME"
    });

    expect(state.canCheckIn).toBe(false);
    expect(state.disabledReason).toBe("เช็กอินแล้ว");
  });

  it("marks history ships as not selectable", () => {
    const state = getUserShipState({
      ...ship,
      now: new Date("2026-05-29T10:00:01.000Z"),
      status: "NOT_CHECKED_IN"
    });

    expect(state.canCheckIn).toBe(false);
    expect(state.isHistory).toBe(true);
    expect(state.disabledReason).toBe("รอบเช็กอินนี้หมดเวลาการเช็กอินแล้ว");
  });

  it("marks trash ships as not returned to users", () => {
    const state = getUserShipState({
      ...ship,
      now: new Date("2026-06-01T10:00:01.000Z"),
      status: "NOT_CHECKED_IN"
    });

    expect(state.canCheckIn).toBe(false);
    expect(state.isTrashEligible).toBe(true);
    expect(state.isExpiredFromHistory).toBe(true);
    expect(state.disabledReason).toBe("รอบเช็กอินนี้หมดเวลาการเช็กอินแล้ว");
  });

  it("exposes a pure selectable helper", () => {
    expect(
      canCheckInShip({
        ...ship,
        now: new Date("2026-05-29T07:55:00.000Z"),
        checkedIn: false
      }).canCheckIn
    ).toBe(true);
    expect(
      canCheckInShip({
        ...ship,
        now: new Date("2026-05-29T07:55:00.000Z"),
        checkedIn: true
      }).canCheckIn
    ).toBe(false);
  });
});
