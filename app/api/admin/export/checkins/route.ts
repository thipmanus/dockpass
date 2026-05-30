import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getStatusThaiLabel } from "@/lib/checkin-status";
import { validateExportDateRange, type ExportCheckinRecord } from "@/lib/export-checkins";
import { createGoogleMapsLink } from "@/lib/maps";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidDateTime } from "@/lib/validation";

type ShipExportRow = {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  start_at: string;
  end_at: string;
  ship_assignees?: {
    id: string;
    email: string;
  }[];
  checkin_logs?: {
    email: string;
    status: "ON_TIME" | "LATE" | "OUT_OF_SHIP" | "TOO_EARLY";
    server_received_at: string;
    lat: number | null;
    lng: number | null;
  }[];
};

export const dynamic = "force-dynamic";

function createExportWindow(startDate: string, endDate: string) {
  return {
    start: new Date(`${startDate}T00:00:00.000+07:00`).toISOString(),
    end: new Date(`${endDate}T23:59:59.999+07:00`).toISOString()
  };
}

function isValidISODate(value: string | null) {
  return Boolean(value && isValidDateTime(`${value}T00:00:00+07:00`));
}

function mapExportRecords(ships: ShipExportRow[]): ExportCheckinRecord[] {
  const records = ships.flatMap((ship) => {
    const logsByEmail = new Map((ship.checkin_logs ?? []).map((log) => [log.email, log]));

    return (ship.ship_assignees ?? []).map((assignee) => {
      const log = logsByEmail.get(assignee.email);
      const status: ExportCheckinRecord["status"] = log?.status === "TOO_EARLY" || !log ? "NOT_CHECKED_IN" : log.status;
      const mapLink = log ? createGoogleMapsLink(log.lat, log.lng) : null;

      return {
        id: `${ship.id}:${assignee.email}`,
        roundId: ship.id,
        title: ship.title ?? ship.name,
        description: ship.description ?? "",
        startAt: ship.start_at,
        endAt: ship.end_at,
        assigneeEmail: assignee.email,
        status,
        statusLabelTh: getStatusThaiLabel(status),
        checkedInAt: log?.server_received_at ?? null,
        latitude: log?.lat ?? null,
        longitude: log?.lng ?? null,
        mapLink
      };
    });
  });

  return records.sort((a, b) => {
    const startCompare = new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
    if (startCompare !== 0) {
      return startCompare;
    }

    const titleCompare = a.title.localeCompare(b.title, "th");
    if (titleCompare !== 0) {
      return titleCompare;
    }

    return a.assigneeEmail.localeCompare(b.assigneeEmail);
  });
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: admin.status });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      return NextResponse.json({ error: "กรุณาเลือกช่วงวันที่ให้ถูกต้อง" }, { status: 400 });
    }

    const selectedStartDate = startDate as string;
    const selectedEndDate = endDate as string;
    const rangeValidation = validateExportDateRange(selectedStartDate, selectedEndDate);
    if (!rangeValidation.ok) {
      return NextResponse.json({ error: rangeValidation.error }, { status: 400 });
    }

    const window = createExportWindow(selectedStartDate, selectedEndDate);
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("ships")
      .select("id,name,title,description,start_at,end_at,ship_assignees(id,email),checkin_logs(email,status,server_received_at,lat,lng)")
      .lte("start_at", window.end)
      .gte("end_at", window.start)
      .order("start_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "โหลดข้อมูลส่งออกไม่สำเร็จ" }, { status: 500 });
    }

    return NextResponse.json({
      records: mapExportRecords((data ?? []) as ShipExportRow[])
    });
  } catch {
    return NextResponse.json({ error: "โหลดข้อมูลส่งออกไม่สำเร็จ" }, { status: 500 });
  }
}
