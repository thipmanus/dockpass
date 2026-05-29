export const SHIP_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SHIP_CODE_LENGTH = 6;

export function normalizeShipCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function isValidShipCode(code: string) {
  const normalized = normalizeShipCode(code);
  return (
    normalized.length === SHIP_CODE_LENGTH &&
    Array.from(normalized).every((character) => SHIP_CODE_CHARSET.includes(character))
  );
}

export function formatShipCode(code: string) {
  const normalized = normalizeShipCode(code).slice(0, SHIP_CODE_LENGTH);
  if (normalized.length <= 3) {
    return normalized;
  }
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

export function generateShipCode() {
  const values = new Uint32Array(SHIP_CODE_LENGTH);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values)
    .map((value) => SHIP_CODE_CHARSET[value % SHIP_CODE_CHARSET.length])
    .join("");
}

export async function hashShipCode(code: string, secret: string) {
  if (!secret) {
    throw new Error("SHIP_CODE_SECRET is required");
  }

  const normalized = normalizeShipCode(code);
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(normalized));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
