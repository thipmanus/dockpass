import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS_PER_MINUTE_BY_IP = 5;
const MAX_ATTEMPTS_PER_TEN_MINUTES_BY_EMAIL = 10;

function getRateLimitSecret() {
  const secret = process.env.RATE_LIMIT_HASH_SECRET || process.env.SHIP_CODE_SECRET;
  if (!secret) {
    throw new Error("RATE_LIMIT_HASH_SECRET or SHIP_CODE_SECRET is required");
  }
  return secret;
}

async function hashValue(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

async function countAttempts(params: {
  supabase: SupabaseClient;
  route: string;
  column: "ip_hash" | "email_hash";
  value: string;
  since: Date;
}) {
  const { count, error } = await params.supabase
    .from("checkin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("route", params.route)
    .eq(params.column, params.value)
    .gte("created_at", params.since.toISOString());

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function enforcePublicCheckinRateLimit(params: {
  supabase: SupabaseClient;
  request: Request;
  route: string;
  email: string;
  codeHash?: string | null;
}) {
  const secret = getRateLimitSecret();

  const ipHash = await hashValue(getClientIp(params.request), secret);
  const emailHash = await hashValue(params.email, secret);
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);

  const { error: insertError } = await params.supabase.from("checkin_attempts").insert({
    route: params.route,
    email_hash: emailHash,
    code_hash: params.codeHash ?? null,
    ip_hash: ipHash
  });

  if (insertError) {
    throw insertError;
  }

  const [ipAttemptsIncludingCurrent, emailAttemptsIncludingCurrent] = await Promise.all([
    countAttempts({
      supabase: params.supabase,
      route: params.route,
      column: "ip_hash",
      value: ipHash,
      since: oneMinuteAgo
    }),
    countAttempts({
      supabase: params.supabase,
      route: params.route,
      column: "email_hash",
      value: emailHash,
      since: tenMinutesAgo
    })
  ]);

  // Current attempt is already recorded, so the configured limit is still allowed.
  if (
    ipAttemptsIncludingCurrent > MAX_ATTEMPTS_PER_MINUTE_BY_IP ||
    emailAttemptsIncludingCurrent > MAX_ATTEMPTS_PER_TEN_MINUTES_BY_EMAIL
  ) {
    return {
      limited: true as const,
      error: "กรุณาลองใหม่อีกครั้งภายหลัง"
    };
  }

  return { limited: false as const };
}
