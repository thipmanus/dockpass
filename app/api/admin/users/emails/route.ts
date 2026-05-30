import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { normalizeEmail } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";
const AUTH_USERS_PAGE_SIZE = 1000;

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) {
    return NextResponse.json(
      { error: admin.status === 401 ? "กรุณาเข้าสู่ระบบ" : "คุณไม่มีสิทธิ์ใช้งานส่วนนี้" },
      { status: admin.status }
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const emails = new Set<string>();

    const { data: assignees, error: assigneeError } = await supabase
      .from("ship_assignees")
      .select("email")
      .order("email", { ascending: true });

    if (assigneeError) {
      return NextResponse.json({ error: "โหลดรายชื่ออีเมลไม่สำเร็จ" }, { status: 500 });
    }

    for (const row of assignees ?? []) {
      const email = normalizeEmail(String(row.email ?? ""));
      if (isValidEmail(email)) {
        emails.add(email);
      }
    }

    for (let page = 1; page < 100; page += 1) {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
        page,
        perPage: AUTH_USERS_PAGE_SIZE
      });

      if (authError) {
        break;
      }

      for (const user of authUsers.users) {
        const email = normalizeEmail(user.email ?? "");
        if (isValidEmail(email)) {
          emails.add(email);
        }
      }

      if (authUsers.users.length < AUTH_USERS_PAGE_SIZE) {
        break;
      }
    }

    return NextResponse.json({ emails: Array.from(emails).sort((a, b) => a.localeCompare(b)) });
  } catch {
    return NextResponse.json({ error: "โหลดรายชื่ออีเมลไม่สำเร็จ" }, { status: 500 });
  }
}
