import "server-only";

// Staff access = a signed-in Supabase user AND a row in admin_users.
// Checked on every admin/kitchen page and in every admin Server Action.
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = { userId: string; email: string; displayName: string };

/** The signed-in staff member, "not_admin" for a signed-in non-staff user, or null. */
export const getAdminSession = cache(async (): Promise<AdminSession | "not_admin" | null> => {
  const supabase = await createSupabaseServerClient();
  // getUser() asks Supabase Auth to confirm the session (not just the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) return "not_admin";

  const { data: profile } = await supabase.from("admin_users").select("display_name").eq("user_id", user.id).maybeSingle();
  return { userId: user.id, email: user.email ?? "", displayName: profile?.display_name ?? user.email ?? "Staff" };
});

/** Use at the top of every admin page/layout and Server Action. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session === null) redirect("/admin/login");
  if (session === "not_admin") redirect("/admin/login?error=not_staff");
  return session;
}

/** Only allow redirects back into the staff area (no open redirects). */
export function safeNextPath(next: unknown) {
  return typeof next === "string" && /^\/(admin|kitchen)(\/[\w\-/]*)?$/.test(next) && next !== "/admin/login" ? next : "/admin";
}
