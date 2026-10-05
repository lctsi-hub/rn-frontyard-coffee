import type { NextConfig } from "next";
import { findPublicSecrets } from "./scripts/env-safety.mjs";

// NEXT_PUBLIC_ values are copied into the JavaScript sent to every visitor.
// Refuse to run or build if a secret (Supabase secret key, tracking secret)
// ended up in one, e.g. keys pasted into the wrong line of .env.local.
const publicSecrets = findPublicSecrets(process.env);
if (publicSecrets.length > 0) {
  throw new Error(
    `Refusing to start: ${publicSecrets.join(", ")} contains a secret value. ` +
      "Secret keys must never use the NEXT_PUBLIC_ prefix. Fix .env.local (values are not printed).",
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
