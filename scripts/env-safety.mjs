// Detects secrets placed in NEXT_PUBLIC_ variables (which Next.js inlines into
// browser JavaScript). Used by next.config.ts to refuse to build, and by
// scripts/check-env.mjs. Only variable NAMES are ever returned or printed.

/** Role claim of a legacy Supabase JWT key, or null. */
function jwtRole(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

/** True for Supabase secret keys (sb_secret_…) and legacy service_role JWTs. */
export function isSupabaseSecretKey(value) {
  return typeof value === "string" && (value.startsWith("sb_secret_") || jwtRole(value) === "service_role");
}

/** Names of NEXT_PUBLIC_ variables that hold a secret value. */
export function findPublicSecrets(env) {
  const serverSecrets = [env.SUPABASE_SECRET_KEY, env.TRACKING_TOKEN_SECRET].filter((v) => v && v.length >= 8);
  return Object.entries(env)
    .filter(([name, value]) => name.startsWith("NEXT_PUBLIC_") && value)
    .filter(([, value]) => isSupabaseSecretKey(value) || serverSecrets.includes(value))
    .map(([name]) => name);
}
