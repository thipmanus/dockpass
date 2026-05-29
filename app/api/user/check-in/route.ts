import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { calculateCheckinStatus, getStatusThaiLabel, type CheckinStatus } from "@/lib/checkin-status";
import { createGoogleMapsLink } from "@/lib/maps";
import { enforcePublicCheckinRateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getUserShipState } from "@/lib/user-ship-state";
import { validateUserCheckinPayload } from "@/lib/validation";

type ShipRow = {
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
};

type ExistingLogRow = {
  status: Exclude<CheckinStatus, "NOT_CHECKED_IN">;
  server_received_at: string;
  accuracy: number | null;
  lat: number | null;
  lng: number | null;
};

export const dynamic = "force-dynamic";

function duplicateResponse(log: ExistingLogRow) {
  return NextResponse.json(
    {
      error: "คุณเช็กอินรอบนี้แล้ว",
      status: log.status,
      status_label: getStatusThaiLabel(log.status),
      timestamp: log.server_received_at,
      accuracy: log.accuracy,
      google_maps_link: createGoogleMapsLink(log.lat, log.lng)
    },
    { status: 409 }
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user || !auth.email) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: auth.status });
    }

    const payload = await request.json().catch(() => null);
    const validated = validateUserCheckinPayload(payload);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const rateLimit = await enforcePublicCheckinRateLimit({
      supabase,
      request,
      route: "/api/user/check-in",
      email: auth.email
    });

    if (rateLimit.limited) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    const { data: assignee, error: assigneeError } = await supabase
      .from("ship_assignees")
      .select("id")
      .eq("ship_id", validated.shipId)
      .eq("email", auth.email)
      .maybeSingle();

    if (assigneeError) {
      return NextResponse.json({ error: "ตรวจสอบสิทธิ์เช็กอินไม่สำเร็จ" }, { status: 500 });
    }

    if (!assignee) {
      return NextResponse.json({ error: "คุณไม่ได้รับมอบหมายให้เช็กอินรอบนี้" }, { status: 403 });
    }

    const { data: ship, error: shipError } = await supabase
      .from("ships")
      .select("id,name,title,description,remark,start_at,end_at,early_checkin_minutes,on_time_until_minutes,close_before_end_minutes")
      .eq("id", validated.shipId)
      .single();

    if (shipError || !ship) {
      return NextResponse.json({ error: "ไม่พบรอบเช็กอิน" }, { status: 404 });
    }

    const { data: existingLog, error: existingError } = await supabase
      .from("checkin_logs")
      .select("status,server_received_at,accuracy,lat,lng")
      .eq("ship_id", validated.shipId)
      .eq("email", auth.email)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: "ตรวจสอบสถานะเช็กอินไม่สำเร็จ" }, { status: 500 });
    }

    if (existingLog) {
      return duplicateResponse(existingLog as ExistingLogRow);
    }

    const serverTime = new Date();
    const shipRow = ship as ShipRow;
    const availability = getUserShipState({
      now: serverTime,
      startAt: shipRow.start_at,
      endAt: shipRow.end_at,
      earlyCheckinMinutes: shipRow.early_checkin_minutes,
      status: "NOT_CHECKED_IN"
    });

    if (!availability.canCheckIn) {
      return NextResponse.json(
        { error: availability.disabledReason ?? "ยังไม่สามารถเช็กอินรอบนี้ได้" },
        { status: 403 }
      );
    }

    const status = calculateCheckinStatus({
      serverTime,
      startAt: shipRow.start_at,
      endAt: shipRow.end_at,
      earlyCheckinMinutes: shipRow.early_checkin_minutes,
      onTimeUntilMinutes: shipRow.on_time_until_minutes,
      closeBeforeEndMinutes: shipRow.close_before_end_minutes
    });

    const { data: log, error: insertError } = await supabase
      .from("checkin_logs")
      .insert({
        ship_id: shipRow.id,
        email: auth.email,
        status,
        lat: validated.lat,
        lng: validated.lng,
        accuracy: validated.accuracy,
        client_captured_at: validated.clientCapturedAt,
        server_received_at: serverTime.toISOString()
      })
      .select("status,server_received_at,accuracy,lat,lng")
      .single();

    if (insertError || !log) {
      if (insertError?.code === "23505") {
        return NextResponse.json({ error: "คุณเช็กอินรอบนี้แล้ว" }, { status: 409 });
      }

      return NextResponse.json({ error: "บันทึกเช็กอินไม่สำเร็จ" }, { status: 500 });
    }

    return NextResponse.json({
      ship: {
        id: shipRow.id,
        title: shipRow.title ?? shipRow.name
      },
      status: log.status,
      status_label: getStatusThaiLabel(log.status),
      timestamp: log.server_received_at,
      accuracy: log.accuracy,
      google_maps_link: createGoogleMapsLink(log.lat, log.lng)
    });
  } catch {
    return NextResponse.json({ error: "บันทึกเช็กอินไม่สำเร็จ" }, { status: 500 });
  }
}
