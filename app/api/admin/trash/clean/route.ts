import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTrashCutoff } from "@/lib/user-ship-state";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await requireAdmin();
    if (!admin.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: admin.status });
    }

    const supabase = createServiceRoleClient();
    const trashCutoff = getTrashCutoff();
    const { data: targets, error: selectError } = await supabase
      .from("ships")
      .select("id")
      .lt("end_at", trashCutoff.toISOString());

    if (selectError) {
      return NextResponse.json({ error: "ตรวจสอบข้อมูลถังขยะไม่สำเร็จ" }, { status: 500 });
    }

    const ids = (targets ?? []).map((ship) => ship.id as string);

    if (ids.length === 0) {
      return NextResponse.json({ deletedCount: 0 });
    }

    const { error: deleteError } = await supabase.from("ships").delete().in("id", ids);

    if (deleteError) {
      return NextResponse.json({ error: "ล้างข้อมูลถังขยะไม่สำเร็จ" }, { status: 500 });
    }

    return NextResponse.json({ deletedCount: ids.length });
  } catch {
    return NextResponse.json({ error: "ล้างข้อมูลถังขยะไม่สำเร็จ" }, { status: 500 });
  }
}
