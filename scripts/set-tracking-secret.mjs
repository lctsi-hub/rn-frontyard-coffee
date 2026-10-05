// Writes a random TRACKING_TOKEN_SECRET into .env.local WITHOUT printing it.
// Refuses to replace an existing value (that would break customers' tracking links).
// Run with: npm run env:tracking-secret
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FILE = ".env.local";
if (!existsSync(FILE)) {
  console.error("✗ .env.local not found. Create it first (copy .env.example to .env.local).");
  process.exit(1);
}

const text = readFileSync(FILE, "utf8");
const line = text.match(/^TRACKING_TOKEN_SECRET=(.*)$/m);
if (line && line[1].trim() !== "") {
  console.log("✓ TRACKING_TOKEN_SECRET already has a value. Left unchanged (value not shown).");
  process.exit(0);
}

const secret = randomBytes(32).toString("base64url");
const next = line
  ? text.replace(/^TRACKING_TOKEN_SECRET=.*$/m, `TRACKING_TOKEN_SECRET=${secret}`)
  : `${text.replace(/\s*$/, "")}\nTRACKING_TOKEN_SECRET=${secret}\n`;
writeFileSync(FILE, next);
console.log("✓ TRACKING_TOKEN_SECRET written to .env.local (256-bit random, value not shown).");
