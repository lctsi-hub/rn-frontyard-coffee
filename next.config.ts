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

// Dev only (`npm run dev:phone`): phones open the dev server by this computer's
// Wi-Fi address (e.g. 192.168.100.8). Next.js blocks dev resources (hot reload)
// for any host except localhost unless it's listed here, and the page then
// never becomes interactive. Only private network ranges are allowed; ignored
// by production builds.
const privateNetworkHosts = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: privateNetworkHosts,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Tracking URLs contain the customer's private token: never leak it via
        // the Referer header, and keep these pages out of search engines.
        source: "/track/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
