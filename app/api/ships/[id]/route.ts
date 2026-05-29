import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createGoogleMapsLink } from "@/lib/maps";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type DetailRow = {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  remark: string | null;
  start_at: string;
  end_at: string;
  early_checkin_minutes: number;
  on_time_until_minutes: number;
  close_before_end_minutes: number;
  ship_assignees?: { email: string }[];
  checkin_logs?: {
    email: string;
    status: string;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    server_received_at: string;
  }[];
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    if (!admin.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: admin.status });
    }

    const { id } = await params;
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("ships")
      .select(
        "id,name,title,description,remark,start_at,end_at,early_checkin_minutes,on_time_until_minutes,close_before_end_minutes,ship_assignees(email),checkin_logs(email,status,lat,lng,accuracy,server_received_at)"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "ไม่พบรอบเช็กอิน" }, { status: 404 });
    }

    const ship = data as DetailRow;
    const logsByEmail = new Map((ship.checkin_logs ?? []).map((log) => [log.email, log]));
    const assignees = (ship.ship_assignees ?? [])
      .map(({ email }) => {
        const log = logsByEmail.get(email);
        return {
          email,
          status: log?.status ?? "NOT_CHECKED_IN",
          server_received_at: log?.server_received_at ?? null,
          accuracy: log?.accuracy ?? null,
          lat: log?.lat ?? null,
          lng: log?.lng ?? null,
          google_maps_link: createGoogleMapsLink(log?.lat, log?.lng)
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({
      ship: {
        id: ship.id,
        title: ship.title ?? ship.name,
        description: ship.description ?? "",
        remark: ship.remark,
        start_at: ship.start_at,
        end_at: ship.end_at,
        early_checkin_minutes: ship.early_checkin_minutes,
        on_time_until_minutes: ship.on_time_until_minutes,
        close_before_end_minutes: ship.close_before_end_minutes
      },
      assignees
    });
  } catch {
    return NextResponse.json({ error: "โหลดรายละเอียดไม่สำเร็จ" }, { status: 500 });
  }
}
