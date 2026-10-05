import "server-only";

// Server-side Supabase client with the PUBLISHABLE key and no user session.
// It reads only what any customer may read (store settings, active delivery
// areas, menu availability), with Row Level Security applied as `anon`.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

export function createSupabasePublicServerClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
