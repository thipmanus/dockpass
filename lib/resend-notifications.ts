import "server-only";

import { createInviteEmailText } from "@/lib/email";

type SendAssigneeNotificationsParams = {
  title: string;
  description: string;
  remark?: string | null;
  startAt: string;
  endAt: string;
  assigneeEmails: string[];
  checkInLink: string;
  calendarLink: string | null;
};

type NotificationSummary = {
  status: "sent" | "skipped" | "failed";
  enabled: boolean;
  attempted: number;
  sent: number;
  failed: number;
};

const RESEND_SEND_TIMEOUT_MS = 10_000;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildNotificationHtml(params: SendAssigneeNotificationsParams) {
  const remarkHtml = params.remark?.trim()
    ? `<p><strong>หมายเหตุ:</strong><br />${escapeHtml(params.remark.trim())}</p>`
    : "";
  const calendarButton = params.calendarLink
    ? `<a href="${escapeHtml(params.calendarLink)}" style="display:inline-block;margin:8px 8px 0 0;padding:12px 16px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">เพิ่มลง Google Calendar</a>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <h1 style="font-size:20px;">คุณได้รับมอบหมายรอบเช็กอิน</h1>
      <p><strong>รอบเช็กอิน:</strong> ${escapeHtml(params.title)}</p>
      <p><strong>รายละเอียด:</strong><br />${escapeHtml(params.description)}</p>
      ${remarkHtml}
      <p><strong>เวลา:</strong> ${escapeHtml(params.startAt)} - ${escapeHtml(params.endAt)}</p>
      <div>
        <a href="${escapeHtml(params.checkInLink)}" style="display:inline-block;margin:8px 8px 0 0;padding:12px 16px;border-radius:8px;background:#0f7ea3;color:#ffffff;text-decoration:none;font-weight:700;">เปิดหน้าเช็กอิน</a>
        ${calendarButton}
      </div>
      <p style="margin-top:16px;color:#475569;">กรุณาเข้าสู่ระบบด้วยอีเมลเดียวกับที่ได้รับมอบหมาย</p>
    </div>
  `;
}

export async function sendAssigneeNotifications(params: SendAssigneeNotificationsParams): Promise<NotificationSummary> {
  const enabled = process.env.ENABLE_EMAIL_NOTIFICATIONS === "true";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "DockPass <onboarding@resend.dev>";

  if (!enabled || !apiKey) {
    return {
      status: "skipped",
      enabled,
      attempted: 0,
      sent: 0,
      failed: 0
    };
  }

  const html = buildNotificationHtml(params);
  const text = createInviteEmailText({
    title: params.title,
    description: params.description,
    remark: params.remark,
    checkInLink: params.checkInLink,
    calendarLink: params.calendarLink
  });

  const results = await Promise.allSettled(
    params.assigneeEmails.map((email) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(RESEND_SEND_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: `DockPass: ${params.title}`,
          text,
          html
        })
      }).then((response) => {
        if (!response.ok) {
          throw new Error("RESEND_SEND_FAILED");
        }
      })
    )
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;

  if (failed > 0) {
    console.warn("DockPass email notification partial failure", {
      total: results.length,
      sent,
      failed
    });
  }

  return {
    status: failed === 0 ? "sent" : sent > 0 ? "sent" : "failed",
    enabled,
    attempted: results.length,
    sent,
    failed
  };
}
