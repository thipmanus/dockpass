import { describe, expect, it } from "vitest";
import {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYYHHmm,
  formatThaiDateDisplay,
  formatThaiDateRangeDisplay,
  formatThaiDateTimeDisplay,
  formatThaiTimeDisplay,
  parseDDMMYYYYHHmmToLocalDateTime,
  parseDDMMYYYYToISODate
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

  it("formats editable date values with Gregorian DD/MM/YYYY", () => {
    expect(formatDateDDMMYYYY("2026-05-30")).toBe("30/05/2026");
    expect(formatDateTimeDDMMYYYYHHmm("2026-05-30T10:39")).toBe("30/05/2026 10:39");
  });

  it("parses editable DD/MM/YYYY values back to internal formats", () => {
    expect(parseDDMMYYYYToISODate("30/05/2026")).toBe("2026-05-30");
    expect(parseDDMMYYYYToISODate("3/5/2026")).toBe("2026-05-03");
    expect(parseDDMMYYYYHHmmToLocalDateTime("30/05/2026 10:39")).toBe("2026-05-30T10:39");
  });

  it("rejects invalid editable dates and times", () => {
    expect(parseDDMMYYYYToISODate("31/02/2026")).toBeNull();
    expect(parseDDMMYYYYToISODate("2026-05-30")).toBeNull();
    expect(parseDDMMYYYYHHmmToLocalDateTime("30/05/2026 24:00")).toBeNull();
    expect(parseDDMMYYYYHHmmToLocalDateTime("30/05/2026 10:99")).toBeNull();
  });
});
