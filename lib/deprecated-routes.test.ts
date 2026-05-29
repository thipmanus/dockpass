import { describe, expect, it } from "vitest";
import { POST as postCheckIn } from "../app/api/check-in/route";
import { POST as postVerify } from "../app/api/check-in/verify/route";

describe("deprecated public check-in routes", () => {
  it("returns 410 for old check-in route", async () => {
    const response = await postCheckIn();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(410);
    expect(body.error).toContain("เข้าสู่ระบบด้วย Google");
  });

  it("returns 410 for old verify route", async () => {
    const response = await postVerify();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(410);
    expect(body.error).toContain("เข้าสู่ระบบด้วย Google");
  });
});
