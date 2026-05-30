"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";

export function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error ? String(error.message) : "";
  return message.toLowerCase().includes("refresh token");
}

export async function clearStaleBrowserSession(supabase: SupabaseClient) {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // If the stored refresh token is already invalid, removing the local session is enough.
  }
}

export async function getBrowserUserOrNull(supabase: SupabaseClient): Promise<User | null> {
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearStaleBrowserSession(supabase);
      }

      return null;
    }

    return user ?? null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearStaleBrowserSession(supabase);
    }

    return null;
  }
}

export async function safeBrowserSignOut(supabase: SupabaseClient) {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    if (!isInvalidRefreshTokenError(error)) {
      throw error;
    }

    await clearStaleBrowserSession(supabase);
  }
}
