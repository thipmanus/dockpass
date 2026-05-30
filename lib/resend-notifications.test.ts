import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendAssigneeNotifications } from "@/lib/resend-notifications";

const baseParams = {
  shipId: "ship-1",
  title: "รอบทดสอบ",
  description: "รายละเอียด",
  remark: null,
  startAt: "2026-05-30T03:30:00.000Z",
  endAt: "2026-05-30T04:45:00.000Z",
  assigneeEmails: ["a@example.com", "b@example.com"],
  checkInLink: "https://dockpass.example.com/check-in",
  calendarLink: "https://calendar.google.com/calendar/render?action=TEMPLATE"
};

const originalEnv = { ...process.env };

describe("sendAssigneeNotifications", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns a skipped summary when the feature flag is disabled", async () => {
    process.env.ENABLE_EMAIL_NOTIFICATIONS = "false";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "DockPass <noreply@example.com>";

    await expect(sendAssigneeNotifications(baseParams)).resolves.toEqual({
      enabled: false,
      skipped: true,
      reason: "feature_disabled",
      total: 2,
      sent: 0,
      failed: 0,
      sentEmails: [],
      failedEmails: []
    });
  });

  it("returns a skipped summary when the Resend API key is missing", async () => {
    process.env.ENABLE_EMAIL_NOTIFICATIONS = "true";
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = "DockPass <noreply@example.com>";

    const summary = await sendAssigneeNotifications(baseParams);

    expect(summary.skipped).toBe(true);
    expect(summary.reason).toBe("missing_api_key");
    expect(summary.total).toBe(2);
  });

  it("returns sent email addresses when all sends succeed", async () => {
    process.env.ENABLE_EMAIL_NOTIFICATIONS = "true";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "DockPass <noreply@example.com>";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const summary = await sendAssigneeNotifications(baseParams);

    expect(summary).toMatchObject({
      enabled: true,
      skipped: false,
      total: 2,
      sent: 2,
      failed: 0,
      sentEmails: ["a@example.com", "b@example.com"],
      failedEmails: []
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).not.toContain("ยังไม่ส่งอีเมลจริง");
  });

  it("returns UI-safe failed messages without exposing raw provider errors", async () => {
    process.env.ENABLE_EMAIL_NOTIFICATIONS = "true";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "DockPass <noreply@example.com>";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(new Response("raw resend provider failure", { status: 500 }))
    );

    const summary = await sendAssigneeNotifications(baseParams);

    expect(summary.sentEmails).toEqual(["a@example.com"]);
    expect(summary.failedEmails).toEqual([
      {
        email: "b@example.com",
        message: "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าอีเมลหรือส่งข้อความแจ้งเตือนด้วยตนเอง"
      }
    ]);
    expect(JSON.stringify(summary)).not.toContain("raw resend provider failure");
  });
});
