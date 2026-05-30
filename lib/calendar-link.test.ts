import { describe, expect, it } from "vitest";
import { createGoogleCalendarLink } from "@/lib/calendar-link";

describe("createGoogleCalendarLink", () => {
  it("generates a Google Calendar template URL with encoded title, details, and dates", () => {
    const url = createGoogleCalendarLink({
      title: "รอบทดสอบ",
      description: "รายละเอียดรอบ",
      remark: "เตรียมเอกสาร",
      startAt: "2026-05-30T03:30:00.000Z",
      endAt: "2026-05-30T04:45:00.000Z",
      checkinUrl: "https://dockpass.example.com/check-in"
    });

    expect(url).toBeTruthy();
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);

    const parsed = new URL(url as string);
    expect(parsed.searchParams.get("text")).toBe("DockPass: รอบทดสอบ");
    expect(parsed.searchParams.get("dates")).toBe("20260530T033000Z/20260530T044500Z");
    expect(parsed.searchParams.get("details")).toContain("รอบเช็กอิน: รอบทดสอบ");
    expect(parsed.searchParams.get("details")).toContain("รายละเอียดรอบ");
    expect(parsed.searchParams.get("details")).toContain("เตรียมเอกสาร");
    expect(parsed.searchParams.get("details")).toContain("https://dockpass.example.com/check-in");
    expect(parsed.searchParams.get("location")).toBe("DockPass");
  });

  it("omits empty optional remark and does not include nullish text", () => {
    const url = createGoogleCalendarLink({
      title: "No remark",
      description: "Description",
      remark: null,
      startAt: new Date("2026-05-30T03:30:00.000Z"),
      endAt: new Date("2026-05-30T04:45:00.000Z"),
      checkinUrl: "http://localhost:3000/check-in"
    });
    const details = new URL(url as string).searchParams.get("details") ?? "";

    expect(details).not.toContain("หมายเหตุ:");
    expect(details).not.toContain("undefined");
    expect(details).not.toContain("null");
  });

  it("returns null for invalid dates", () => {
    expect(
      createGoogleCalendarLink({
        title: "Invalid",
        description: "Invalid",
        startAt: "invalid",
        endAt: "2026-05-30T04:45:00.000Z",
        checkinUrl: "http://localhost:3000/check-in"
      })
    ).toBeNull();
  });
});
