import "server-only";

// Server Supabase client for Server Components, Server Actions and Route
// Handlers. Uses the publishable key plus the visitor's auth cookies, so it acts as
// the signed-in user (e.g. Bam in the admin dashboard) and RLS applies.
// Create a new one per request; never share it between requests.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. Session
          // refresh will be handled by the proxy once admin login exists.
        }
      },
    },
  });
}
