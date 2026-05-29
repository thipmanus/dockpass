import { describe, expect, it } from "vitest";
import { calculateCheckinStatus } from "./checkin-status";

const baseParams = {
  startAt: "2026-05-29T08:00:00.000Z",
  endAt: "2026-05-29T09:00:00.000Z",
  earlyCheckinMinutes: 5,
  onTimeUntilMinutes: 10,
  closeBeforeEndMinutes: 5
};

describe("calculateCheckinStatus", () => {
  it("returns TOO_EARLY before the early check-in window", () => {
    expect(
      calculateCheckinStatus({
        ...baseParams,
        serverTime: new Date("2026-05-29T07:54:59.000Z")
      })
    ).toBe("TOO_EARLY");
  });

  it("returns ON_TIME at the early boundary and on-time end boundary", () => {
    expect(
      calculateCheckinStatus({
        ...baseParams,
        serverTime: new Date("2026-05-29T07:55:00.000Z")
      })
    ).toBe("ON_TIME");
    expect(
      calculateCheckinStatus({
        ...baseParams,
        serverTime: new Date("2026-05-29T08:10:00.000Z")
      })
    ).toBe("ON_TIME");
  });

  it("returns LATE after on-time window until close boundary", () => {
    expect(
      calculateCheckinStatus({
        ...baseParams,
        serverTime: new Date("2026-05-29T08:10:01.000Z")
      })
    ).toBe("LATE");
    expect(
      calculateCheckinStatus({
        ...baseParams,
        serverTime: new Date("2026-05-29T08:55:00.000Z")
      })
    ).toBe("LATE");
  });

  it("returns OUT_OF_SHIP after close boundary through end_at + 1 hour", () => {
    expect(
      calculateCheckinStatus({
        ...baseParams,
        serverTime: new Date("2026-05-29T08:55:01.000Z")
      })
    ).toBe("OUT_OF_SHIP");
    expect(
      calculateCheckinStatus({
        ...baseParams,
        serverTime: new Date("2026-05-29T10:00:00.000Z")
      })
    ).toBe("OUT_OF_SHIP");
  });
});
