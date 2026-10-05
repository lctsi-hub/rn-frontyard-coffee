// Checks .env.local WITHOUT printing any secret value: only whether each
// variable is present and has the expected shape. Does not contact Supabase.
// Run with: npm run env:check
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import nextEnv from "@next/env";
import { findPublicSecrets, isSupabaseSecretKey } from "./env-safety.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const env = process.env;

const results = [];
const check = (ok, label, hint = "") => results.push({ ok, label, hint });

check(existsSync(".env.local"), ".env.local exists in the project folder");
const ignored = spawnSync("git", ["check-ignore", "-q", ".env.local"]).status === 0;
check(ignored, ".env.local is ignored by Git", "it must never be committed");

// NEXT_PUBLIC_SUPABASE_URL (public; the host is shown because it's not secret)
let host = "";
try {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  host = url.host;
  check(
    url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && (url.pathname === "/" || url.pathname === ""),
    `NEXT_PUBLIC_SUPABASE_URL looks like a project URL (${host})`,
    "expected https://<project-ref>.supabase.co with nothing after it",
  );
} catch {
  check(false, "NEXT_PUBLIC_SUPABASE_URL is set to a URL", "expected https://<project-ref>.supabase.co");
}

const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
check(publishable.startsWith("sb_publishable_"), "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a publishable key (sb_publishable_…)");

const secret = env.SUPABASE_SECRET_KEY ?? "";
check(secret.startsWith("sb_secret_"), "SUPABASE_SECRET_KEY is a secret key (sb_secret_…)");
check(!Object.keys(env).includes("NEXT_PUBLIC_SUPABASE_SECRET_KEY"), "no NEXT_PUBLIC_SUPABASE_SECRET_KEY variable exists");

const tracking = env.TRACKING_TOKEN_SECRET ?? "";
check(tracking.length >= 32, "TRACKING_TOKEN_SECRET is at least 32 characters");
check(!tracking || (tracking !== secret && tracking !== publishable), "TRACKING_TOKEN_SECRET is its own value (not a Supabase key)");

const leaked = findPublicSecrets(env);
check(leaked.length === 0, "no secret is in a NEXT_PUBLIC_ variable", leaked.length ? `move out of: ${leaked.join(", ")}` : "");
check(!isSupabaseSecretKey(publishable), "the publishable key is not a secret key");

for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.label}${!r.ok && r.hint ? `  → ${r.hint}` : ""}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed. No values were printed.` : "\nAll checks passed. No values were printed.");
process.exit(failed ? 1 : 0);
