import { describe, expect, it } from "vitest";
import { createInviteEmailText, createInvitePreview } from "@/lib/email";

const params = {
  title: "รอบทดสอบ",
  description: "รายละเอียด",
  remark: "เตรียมเอกสาร",
  checkInLink: "https://dockpass.example.com/check-in",
  calendarLink: "https://calendar.google.com/calendar/render?action=TEMPLATE"
};

describe("invite email text", () => {
  it("does not include manual-copy MVP wording in outbound email text", () => {
    const text = createInviteEmailText(params);

    expect(text).toContain("เปิดหน้าเช็กอิน");
    expect(text).toContain("เพิ่มลง Google Calendar");
    expect(text).not.toContain("ยังไม่ส่งอีเมลจริง");
    expect(text).not.toContain("คัดลอกข้อความนี้");
  });

  it("keeps manual-copy wording in admin preview text", () => {
    const preview = createInvitePreview(params);

    expect(preview).toContain("หากยังไม่ได้เปิดการส่งอีเมล");
    expect(preview).toContain("คัดลอกข้อความนี้");
  });
});
