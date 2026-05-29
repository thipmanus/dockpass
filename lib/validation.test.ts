import { describe, expect, it } from "vitest";
import { validateCreateShipPayload, validateUserCheckinPayload } from "./validation";

const validCreatePayload = {
  title: "รอบเอกสาร",
  description: "รายละเอียดสำหรับทดสอบ",
  remark: "หมายเหตุ",
  start_at: "2026-05-29T08:00:00.000Z",
  end_at: "2026-05-29T10:00:00.000Z",
  assigned_emails: "User@example.com\nuser@example.com, second@example.com",
  early_checkin_minutes: 5,
  on_time_until_minutes: 10,
  close_before_end_minutes: 5
};

describe("validateCreateShipPayload", () => {
  it("accepts cross-day ships when duration is within 24 hours and dedupes emails", () => {
    const result = validateCreateShipPayload({
      ...validCreatePayload,
      start_at: "2026-05-29T17:00:00.000Z",
      end_at: "2026-05-30T16:59:59.000Z"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assignedEmails).toEqual(["user@example.com", "second@example.com"]);
    }
  });

  it("rejects missing or too long title", () => {
    expect(validateCreateShipPayload({ ...validCreatePayload, title: "" }).ok).toBe(false);
    expect(validateCreateShipPayload({ ...validCreatePayload, title: "ก".repeat(51) }).ok).toBe(false);
  });

  it("rejects missing or too long description", () => {
    expect(validateCreateShipPayload({ ...validCreatePayload, description: "" }).ok).toBe(false);
    expect(validateCreateShipPayload({ ...validCreatePayload, description: "ก".repeat(501) }).ok).toBe(false);
  });

  it("rejects too long remark", () => {
    expect(validateCreateShipPayload({ ...validCreatePayload, remark: "ก".repeat(251) }).ok).toBe(false);
  });

  it("rejects ships longer than 24 hours", () => {
    expect(
      validateCreateShipPayload({
        ...validCreatePayload,
        end_at: "2026-05-30T10:00:01.000Z"
      }).ok
    ).toBe(false);
  });

  it("rejects more than 200 assigned emails", () => {
    const assignedEmails = Array.from({ length: 201 }, (_, index) => `user${index}@example.com`).join("\n");
    expect(validateCreateShipPayload({ ...validCreatePayload, assigned_emails: assignedEmails }).ok).toBe(false);
  });
});

describe("validateUserCheckinPayload", () => {
  const validCheckinPayload = {
    ship_id: "11111111-1111-4111-8111-111111111111",
    lat: 13.7563,
    lng: 100.5018,
    accuracy: 25,
    client_captured_at: "2026-05-29T08:01:00.000Z"
  };

  it("accepts valid location payload", () => {
    expect(validateUserCheckinPayload(validCheckinPayload).ok).toBe(true);
  });

  it("rejects invalid lat/lng/accuracy", () => {
    expect(validateUserCheckinPayload({ ...validCheckinPayload, lat: 91 }).ok).toBe(false);
    expect(validateUserCheckinPayload({ ...validCheckinPayload, lng: 181 }).ok).toBe(false);
    expect(validateUserCheckinPayload({ ...validCheckinPayload, accuracy: -1 }).ok).toBe(false);
  });
});
