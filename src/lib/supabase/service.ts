import "server-only";

// PRIVILEGED Supabase client (service role). Bypasses Row Level Security, so it
// is used in exactly one place: saving orders and reading tracking data on the
// server (src/lib/orders/place-order.ts). Rules:
// - server-only: importing this from a Client Component fails the build
// - the key has no NEXT_PUBLIC_ prefix, so Next.js never sends it to the browser
// - never log the key or the client's config
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function isServiceRoleConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    // Names only; never include the values.
    throw new Error("Supabase service client is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
