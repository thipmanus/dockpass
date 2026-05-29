import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTrashCutoff } from "@/lib/user-ship-state";

type TrashShipRow = {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  remark: string | null;
  start_at: string;
  end_at: string;
  ship_assignees?: { id: string }[];
  checkin_logs?: { id: string }[];
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: admin.status });
    }

    const now = new Date();
    const trashCutoff = getTrashCutoff(now);
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("ships")
      .select("id,name,title,description,remark,start_at,end_at,ship_assignees(id),checkin_logs(id)")
      .lt("end_at", trashCutoff.toISOString())
      .order("end_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "โหลดข้อมูลถังขยะไม่สำเร็จ" }, { status: 500 });
    }

    const ships = ((data ?? []) as TrashShipRow[]).map((ship) => ({
      id: ship.id,
      title: ship.title ?? ship.name,
      description: ship.description ?? "",
      remark: ship.remark,
      start_at: ship.start_at,
      end_at: ship.end_at,
      assigned_count: ship.ship_assignees?.length ?? 0,
      checked_in_count: ship.checkin_logs?.length ?? 0,
      expired_at: new Date(new Date(ship.end_at).getTime() + 73 * 60 * 60 * 1000).toISOString()
    }));

    return NextResponse.json({
      server_time: now.toISOString(),
      ships
    });
  } catch {
    return NextResponse.json({ error: "โหลดข้อมูลถังขยะไม่สำเร็จ" }, { status: 500 });
  }
}
