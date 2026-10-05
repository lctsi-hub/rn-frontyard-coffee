import "server-only";

// PRIVILEGED Supabase client (secret key, acts as the database's service_role).
// Bypasses Row Level Security, so it is used in exactly one place: saving
// orders and reading tracking data on the server (src/lib/orders/place-order.ts).
// Rules:
// - server-only: importing this from a Client Component fails the build
// - SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so Next.js never sends it to
//   the browser (next.config.ts also refuses to build if a secret is public)
// - never log the key or the client's config
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function isSecretKeyConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    // Names only; never include the values.
    throw new Error("Supabase server client is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).");
  }
  if (secretKey.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SECRET_KEY contains a publishable key; use the secret key (sb_secret_…).");
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
