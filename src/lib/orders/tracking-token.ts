import "server-only";

// Customer tracking tokens.
//
// - The raw token is a 256-bit HMAC-SHA256 of the checkout attempt's idempotency
//   key, keyed with TRACKING_TOKEN_SECRET. It is unguessable without the secret,
//   and a safe retry of the same checkout attempt gets the same token back.
// - The database stores only SHA-256(raw token). The raw token is returned to
//   the customer once, after the order is saved, and is never stored or logged.
import { createHash, createHmac } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes as base64url

function trackingSecret() {
  const secret = process.env.TRACKING_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("TRACKING_TOKEN_SECRET is missing or shorter than 32 characters.");
  }
  return secret;
}

export function isTrackingSecretConfigured() {
  return (process.env.TRACKING_TOKEN_SECRET?.length ?? 0) >= 32;
}

export function trackingTokenFor(clientRequestId: string) {
  return createHmac("sha256", trackingSecret()).update(`rnfc-tracking-v1:${clientRequestId}`).digest("base64url");
}

export function hashTrackingToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedTrackingToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}
