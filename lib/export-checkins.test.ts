import { describe, expect, it } from "vitest";
import { createCheckinCsv, getExportStatusThaiLabel, validateExportDateRange, type ExportCheckinRecord } from "@/lib/export-checkins";
import { createGoogleMapsLink } from "@/lib/maps";

const baseRecord: ExportCheckinRecord = {
  id: "round-1:user@example.com",
  roundId: "round-1",
  title: "รอบทดสอบ",
  description: "รายละเอียด",
  startAt: "2026-05-30T03:00:00.000Z",
  endAt: "2026-05-30T04:00:00.000Z",
  assigneeEmail: "user@example.com",
  status: "ON_TIME",
  statusLabelTh: "ตรงเวลา",
  checkedInAt: "2026-05-30T03:05:00.000Z",
  latitude: 13.7563,
  longitude: 100.5018,
  mapLink: "https://www.google.com/maps?q=13.7563,100.5018"
};

describe("export check-in helpers", () => {
  it("validates the maximum export range at 30 days", () => {
    expect(validateExportDateRange("2026-05-01", "2026-05-30")).toEqual({ ok: true, days: 30 });
    expect(validateExportDateRange("2026-05-01", "2026-05-31")).toEqual({
      ok: false,
      error: "เลือกช่วงวันที่ได้สูงสุด 30 วัน"
    });
  });

  it("escapes CSV fields and prefixes the file with a UTF-8 BOM", () => {
    const csv = createCheckinCsv([
      {
        ...baseRecord,
        title: 'รอบ "พิเศษ"',
        description: "บรรทัดแรก\nบรรทัดสอง, มี comma"
      }
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"รอบ ""พิเศษ"""');
    expect(csv).toContain('"บรรทัดแรก\nบรรทัดสอง, มี comma"');
  });

  it("neutralizes CSV formula payloads before exporting", () => {
    const csv = createCheckinCsv([
      {
        ...baseRecord,
        title: "=IMPORTXML(\"https://example.com\")",
        description: "+SUM(1,2)",
        assigneeEmail: "@attacker.example"
      }
    ]);

    expect(csv).toContain(`"'=IMPORTXML(""https://example.com"")"`);
    expect(csv).toContain(`"'+SUM(1,2)"`);
    expect(csv).toContain("'@attacker.example");
  });

  it("maps export statuses to Thai labels", () => {
    expect(getExportStatusThaiLabel("ON_TIME")).toBe("ตรงเวลา");
    expect(getExportStatusThaiLabel("LATE")).toBe("สาย");
    expect(getExportStatusThaiLabel("OUT_OF_SHIP")).toBe("นอกรอบ");
    expect(getExportStatusThaiLabel("NOT_CHECKED_IN")).toBe("ยังไม่เช็กอิน");
  });

  it("creates map links only when latitude and longitude exist", () => {
    expect(createGoogleMapsLink(13.7563, 100.5018)).toBe("https://www.google.com/maps?q=13.7563,100.5018");
    expect(createGoogleMapsLink(null, 100.5018)).toBeNull();
    expect(createGoogleMapsLink(13.7563, null)).toBeNull();
  });
});
