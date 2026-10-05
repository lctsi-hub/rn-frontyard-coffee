// Browser Supabase client (anon key only). For things that must happen in the
// browser later: live order-status updates and the admin login session.
// Never use it to write orders; those go through the server.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, anonKey);
}
