import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/allowlist";

export async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "UNAUTHENTICATED", status: 401 as const };
  }

  if (!isAdminEmail(user.email)) {
    return { user: null, error: "FORBIDDEN", status: 403 as const };
  }

  return { user, error: null, status: 200 as const };
}
