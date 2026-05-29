import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/email";

export async function requireAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  const email = normalizeEmail(user?.email ?? "");

  if (error || !user || !email) {
    return { user: null, email: null, error: "UNAUTHENTICATED", status: 401 as const };
  }

  return { user, email, error: null, status: 200 as const };
}
