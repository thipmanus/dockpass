import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateShipCode, hashShipCode } from "@/lib/ship-code";
import { isValidDateTime, validateCreateShipPayload } from "@/lib/validation";
import { createInvitePreview, normalizeEmail } from "@/lib/email";
import { getTrashCutoff } from "@/lib/user-ship-state";
import { createGoogleCalendarLink, getAppUrl } from "@/lib/calendar-link";
import { sendAssigneeNotifications } from "@/lib/resend-notifications";

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
  ship_assignees?: { email: string }[];
  checkin_logs?: { status: string; email: string }[];
};

export const dynamic = "force-dynamic";

function getShipCodeSecret() {
  const secret = process.env.SHIP_CODE_SECRET;
  if (!secret) {
    throw new Error("SHIP_CODE_SECRET is missing");
  }
  return secret;
}

function createDateFilter(url: URL) {
  const date = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (date && isValidDateTime(`${date}T00:00:00+07:00`)) {
    const start = new Date(`${date}T00:00:00.000+07:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString(), exclusiveTo: true };
  }

  return {
    from:
      from && isValidDateTime(`${from}T00:00:00+07:00`)
        ? new Date(`${from}T00:00:00.000+07:00`).toISOString()
        : null,
    to:
      to && isValidDateTime(`${to}T23:59:59+07:00`)
        ? new Date(`${to}T23:59:59.999+07:00`).toISOString()
        : null,
    exclusiveTo: false
  };
}

function mapShipSummary(ship: ShipRow) {
  const assigneeCount = ship.ship_assignees?.length ?? 0;
  const logs = ship.checkin_logs ?? [];
  const statusCounts = {
    ON_TIME: 0,
    LATE: 0,
    OUT_OF_SHIP: 0,
    TOO_EARLY: 0
  };

  for (const log of logs) {
    if (log.status in statusCounts) {
      statusCounts[log.status as keyof typeof statusCounts] += 1;
    }
  }

  return {
    id: ship.id,
    title: ship.title ?? ship.name,
    description: ship.description ?? "",
    remark: ship.remark,
    start_at: ship.start_at,
    end_at: ship.end_at,
    assigned_count: assigneeCount,
    checked_in_count: logs.length,
    not_checked_in_count: Math.max(assigneeCount - logs.length, 0),
    status_counts: statusCounts
  };
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: admin.status });
    }

    const supabase = createServiceRoleClient();
    const url = new URL(request.url);
    const filter = createDateFilter(url);
    const assignedEmail = normalizeEmail(url.searchParams.get("assignedEmail") ?? "");
    const trashCutoff = getTrashCutoff();

    let query = supabase
      .from("ships")
      .select(
        "id,name,title,description,remark,start_at,end_at,early_checkin_minutes,on_time_until_minutes,close_before_end_minutes,ship_assignees(email),checkin_logs(status,email)"
      )
      .gte("end_at", trashCutoff.toISOString())
      .order("start_at", { ascending: false });

    if (filter.from) {
      query = query.gte("start_at", filter.from);
    }

    if (filter.to) {
      query = filter.exclusiveTo ? query.lt("start_at", filter.to) : query.lte("start_at", filter.to);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "โหลดรายการรอบเช็กอินไม่สำเร็จ" }, { status: 500 });
    }

    const rows = ((data ?? []) as ShipRow[]).filter((ship) => {
      if (!assignedEmail) {
        return true;
      }

      return (ship.ship_assignees ?? []).some((assignee) => assignee.email.includes(assignedEmail));
    });

    const ships = rows.map(mapShipSummary);
    const summary = ships.reduce(
      (acc, ship) => {
        acc.assigned += ship.assigned_count;
        acc.checked_in += ship.checked_in_count;
        acc.on_time += ship.status_counts.ON_TIME;
        acc.late += ship.status_counts.LATE;
        acc.out_of_ship += ship.status_counts.OUT_OF_SHIP;
        acc.too_early += ship.status_counts.TOO_EARLY;
        acc.not_checked_in += ship.not_checked_in_count;
        return acc;
      },
      {
        assigned: 0,
        checked_in: 0,
        on_time: 0,
        late: 0,
        not_checked_in: 0,
        out_of_ship: 0,
        too_early: 0
      }
    );

    return NextResponse.json({ ships, summary });
  } catch {
    return NextResponse.json({ error: "โหลดรายการรอบเช็กอินไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: admin.status });
    }

    const payload = await request.json().catch(() => null);
    const validated = validateCreateShipPayload(payload);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const secret = getShipCodeSecret();
    let codeHash = "";

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const generatedCode = generateShipCode();
      codeHash = await hashShipCode(generatedCode, secret);
      const { data: existing } = await supabase
        .from("ships")
        .select("id")
        .eq("code_hash", codeHash)
        .maybeSingle();

      if (!existing) {
        break;
      }
    }

    const { data: ship, error: shipError } = await supabase
      .from("ships")
      .insert({
        name: validated.title,
        title: validated.title,
        description: validated.description,
        remark: validated.remark,
        code_hash: codeHash,
        start_at: validated.startAt,
        end_at: validated.endAt,
        early_checkin_minutes: validated.earlyCheckinMinutes,
        on_time_until_minutes: validated.onTimeUntilMinutes,
        close_before_end_minutes: validated.closeBeforeEndMinutes,
        created_by: admin.user.id
      })
      .select("id,name,title,description,remark,start_at,end_at")
      .single();

    if (shipError || !ship) {
      return NextResponse.json({ error: "สร้างรอบเช็กอินไม่สำเร็จ" }, { status: 500 });
    }

    const { error: assigneeError } = await supabase.from("ship_assignees").insert(
      validated.assignedEmails.map((email) => ({
        ship_id: ship.id,
        email
      }))
    );

    if (assigneeError) {
      await supabase.from("ships").delete().eq("id", ship.id);
      return NextResponse.json({ error: "บันทึกรายชื่อผู้ได้รับมอบหมายไม่สำเร็จ" }, { status: 500 });
    }

    const appUrl = getAppUrl(request.url);
    const portalLink = `${appUrl}/check-in`;
    const calendarLink = createGoogleCalendarLink({
      title: ship.title ?? ship.name,
      description: ship.description ?? "",
      remark: ship.remark,
      startAt: ship.start_at,
      endAt: ship.end_at,
      checkinUrl: portalLink
    });
    const notificationSummary = await sendAssigneeNotifications({
      shipId: ship.id,
      title: ship.title ?? ship.name,
      description: ship.description ?? "",
      remark: ship.remark,
      startAt: ship.start_at,
      endAt: ship.end_at,
      assigneeEmails: validated.assignedEmails,
      checkInLink: portalLink,
      calendarLink
    }).catch(() => ({
      enabled: process.env.ENABLE_EMAIL_NOTIFICATIONS === "true",
      skipped: false,
      total: validated.assignedEmails.length,
      sent: 0,
      failed: validated.assignedEmails.length,
      sentEmails: [],
      failedEmails: validated.assignedEmails.map((email) => ({
        email,
        message: "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าอีเมลหรือส่งข้อความแจ้งเตือนด้วยตนเอง"
      }))
    }));

    return NextResponse.json({
      ship,
      portal_link: portalLink,
      calendar_link: calendarLink,
      invite_preview: createInvitePreview({
        title: ship.title ?? ship.name,
        description: ship.description ?? "",
        remark: ship.remark,
        checkInLink: portalLink,
        calendarLink
      }),
      notification_summary: notificationSummary,
      assigned_emails: validated.assignedEmails
    });
  } catch {
    return NextResponse.json({ error: "สร้างรอบเช็กอินไม่สำเร็จ" }, { status: 500 });
  }
}
