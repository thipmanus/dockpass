import "server-only";

import { createInviteEmailText } from "@/lib/email";

type SendAssigneeNotificationsParams = {
  shipId?: string;
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
  enabled: boolean;
  skipped: boolean;
  reason?: "feature_disabled" | "missing_api_key" | "missing_from_email" | "no_assignees";
  total: number;
  sent: number;
  failed: number;
  sentEmails: string[];
  failedEmails: {
    email: string;
    message: string;
  }[];
};

const RESEND_SEND_TIMEOUT_MS = 10_000;
const UI_SAFE_SEND_FAILURE_MESSAGE = "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าอีเมลหรือส่งข้อความแจ้งเตือนด้วยตนเอง";

type SendResult =
  | {
      ok: true;
      email: string;
    }
  | {
      ok: false;
      email: string;
      providerStatus?: number;
      providerMessage?: string;
    };

function createSkippedSummary(params: {
  enabled: boolean;
  reason: NonNullable<NotificationSummary["reason"]>;
  total: number;
}): NotificationSummary {
  return {
    enabled: params.enabled,
    skipped: true,
    reason: params.reason,
    total: params.total,
    sent: 0,
    failed: 0,
    sentEmails: [],
    failedEmails: []
  };
}

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
  const from = process.env.RESEND_FROM_EMAIL;

  if (params.assigneeEmails.length === 0) {
    return createSkippedSummary({ enabled, reason: "no_assignees", total: 0 });
  }

  if (!enabled) {
    return createSkippedSummary({ enabled, reason: "feature_disabled", total: params.assigneeEmails.length });
  }

  if (!apiKey) {
    return createSkippedSummary({ enabled, reason: "missing_api_key", total: params.assigneeEmails.length });
  }

  if (!from) {
    return createSkippedSummary({ enabled, reason: "missing_from_email", total: params.assigneeEmails.length });
  }

  const html = buildNotificationHtml(params);
  const text = createInviteEmailText({
    title: params.title,
    description: params.description,
    remark: params.remark,
    checkInLink: params.checkInLink,
    calendarLink: params.calendarLink
  });

  const results = await Promise.all(
    params.assigneeEmails.map(async (email): Promise<SendResult> => {
      try {
        const response = await fetch("https://api.resend.com/emails", {
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
        });

        if (response.ok) {
          return { ok: true, email };
        }

        return {
          ok: false,
          email,
          providerStatus: response.status,
          providerMessage: await response.text().catch(() => "Unable to read Resend response")
        };
      } catch (error) {
        return {
          ok: false,
          email,
          providerMessage: error instanceof Error ? error.message : "Unknown Resend send error"
        };
      }
    })
  );

  const sentEmails = results.filter((result): result is Extract<SendResult, { ok: true }> => result.ok).map((result) => result.email);
  const failedResults = results.filter((result): result is Extract<SendResult, { ok: false }> => !result.ok);
  const sent = sentEmails.length;
  const failed = results.length - sent;

  if (failed > 0) {
    console.warn("DockPass email notification partial failure", {
      shipId: params.shipId,
      total: results.length,
      sent,
      failed,
      failedEmails: failedResults.map((result) => ({
        email: result.email,
        providerStatus: result.providerStatus,
        providerMessage: result.providerMessage
      }))
    });
  }

  return {
    enabled,
    skipped: false,
    total: results.length,
    sent,
    failed,
    sentEmails,
    failedEmails: failedResults.map((result) => ({
      email: result.email,
      message: UI_SAFE_SEND_FAILURE_MESSAGE
    }))
  };
}
