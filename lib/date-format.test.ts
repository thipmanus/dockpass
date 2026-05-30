import { describe, expect, it } from "vitest";
import {
  formatThaiDateDisplay,
  formatThaiDateRangeDisplay,
  formatThaiDateTimeDisplay,
  formatThaiTimeDisplay
} from "./date-format";

describe("date display formatting", () => {
  it("formats Bangkok dates with Buddhist Era years", () => {
    expect(formatThaiDateDisplay("2026-05-29T17:00:00.000Z")).toBe("30/05/2569");
    expect(formatThaiDateTimeDisplay("2026-05-29T17:00:00.000Z")).toBe("30/05/2569 00:00");
    expect(formatThaiTimeDisplay("2026-05-29T17:00:00.000Z")).toBe("00:00");
  });

  it("formats date ranges", () => {
    expect(
      formatThaiDateRangeDisplay("2026-05-29T17:00:00.000Z", "2026-05-30T00:00:00.000Z")
    ).toBe("30/05/2569 00:00 - 30/05/2569 07:00");
  });

  it("returns a dash for empty or invalid values", () => {
    expect(formatThaiDateDisplay("")).toBe("-");
    expect(formatThaiDateTimeDisplay("not-a-date")).toBe("-");
  });
});
