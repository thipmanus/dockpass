import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { calculateCheckinStatus, getStatusThaiLabel, type CheckinStatus } from "@/lib/checkin-status";
import { createGoogleMapsLink } from "@/lib/maps";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getUserShipState, isWithinThaiDate } from "@/lib/user-ship-state";

type ShipForUser = {
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

type AssignedShipRow = {
  ship_id: string;
  ships: ShipForUser | ShipForUser[] | null;
};

type CheckinLogRow = {
  ship_id: string;
  status: Exclude<CheckinStatus, "NOT_CHECKED_IN">;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  server_received_at: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user || !auth.email) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: auth.status });
    }

    const supabase = createServiceRoleClient();
    const now = new Date();
    const { data: assignedRows, error: assignedError } = await supabase
      .from("ship_assignees")
      .select(
        "ship_id,ships(id,name,title,description,remark,start_at,end_at,early_checkin_minutes,on_time_until_minutes,close_before_end_minutes)"
      )
      .eq("email", auth.email);

    if (assignedError) {
      return NextResponse.json({ error: "โหลดรายการรอบเช็กอินไม่สำเร็จ" }, { status: 500 });
    }

    const shipRows = ((assignedRows ?? []) as unknown as AssignedShipRow[])
      .map((row) => (Array.isArray(row.ships) ? row.ships[0] : row.ships))
      .filter((ship): ship is ShipForUser => Boolean(ship));
    const shipIds = shipRows.map((ship) => ship.id);

    const logsByShipId = new Map<string, CheckinLogRow>();
    if (shipIds.length > 0) {
      const { data: logs, error: logsError } = await supabase
        .from("checkin_logs")
        .select("ship_id,status,lat,lng,accuracy,server_received_at")
        .eq("email", auth.email)
        .in("ship_id", shipIds);

      if (logsError) {
        return NextResponse.json({ error: "โหลดประวัติเช็กอินไม่สำเร็จ" }, { status: 500 });
      }

      for (const log of (logs ?? []) as CheckinLogRow[]) {
        logsByShipId.set(log.ship_id, log);
      }
    }

    const ships = shipRows
      .map((ship) => {
        const log = logsByShipId.get(ship.id);
        const status = (log?.status ?? "NOT_CHECKED_IN") as CheckinStatus;
        const state = getUserShipState({
          now,
          startAt: ship.start_at,
          endAt: ship.end_at,
          earlyCheckinMinutes: ship.early_checkin_minutes,
          status
        });
        const expectedCheckinStatus =
          state.canCheckIn && status === "NOT_CHECKED_IN"
            ? calculateCheckinStatus({
                serverTime: now,
                startAt: ship.start_at,
                endAt: ship.end_at,
                earlyCheckinMinutes: ship.early_checkin_minutes,
                onTimeUntilMinutes: ship.on_time_until_minutes,
                closeBeforeEndMinutes: ship.close_before_end_minutes
              })
            : null;

        return {
          id: ship.id,
          title: ship.title ?? ship.name,
          description: ship.description ?? "",
          remark: ship.remark,
          start_at: ship.start_at,
          end_at: ship.end_at,
          early_checkin_minutes: ship.early_checkin_minutes,
          on_time_until_minutes: ship.on_time_until_minutes,
          close_before_end_minutes: ship.close_before_end_minutes,
          status,
          status_label: getStatusThaiLabel(status),
          expected_checkin_status: expectedCheckinStatus,
          expected_checkin_status_label: expectedCheckinStatus
            ? getStatusThaiLabel(expectedCheckinStatus)
            : null,
          checked_in_at: log?.server_received_at ?? null,
          accuracy: log?.accuracy ?? null,
          google_maps_link: createGoogleMapsLink(log?.lat, log?.lng),
          can_check_in: state.canCheckIn,
          disabled_reason: state.disabledReason,
          is_history: state.isHistory,
          is_today: isWithinThaiDate(ship.start_at, now),
          checkin_open_at: state.checkinOpenAt.toISOString(),
          is_expired_from_history: state.isExpiredFromHistory
        };
      })
      .filter((ship) => !ship.is_expired_from_history)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    return NextResponse.json({
      user: {
        email: auth.email
      },
      server_time: now.toISOString(),
      ships
    });
  } catch {
    return NextResponse.json({ error: "โหลดรายการรอบเช็กอินไม่สำเร็จ" }, { status: 500 });
  }
}
