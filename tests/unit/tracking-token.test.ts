import assert from "node:assert/strict";
import { before, test } from "node:test";

before(() => {
  process.env.TRACKING_TOKEN_SECRET = "test-secret-that-is-at-least-32-characters-long";
});

test("tracking tokens: high entropy, stable per checkout attempt, stored only as a hash", async () => {
  const { hashTrackingToken, isWellFormedTrackingToken, trackingTokenFor } = await import("@/lib/orders/tracking-token");
  const a = trackingTokenFor("3f6c2a1e-8b7d-4c5e-9f0a-1b2c3d4e5f60");
  const again = trackingTokenFor("3f6c2a1e-8b7d-4c5e-9f0a-1b2c3d4e5f60");
  const b = trackingTokenFor("9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d");

  assert.equal(a.length, 43, "32 random-looking bytes as base64url");
  assert.ok(isWellFormedTrackingToken(a));
  assert.equal(a, again, "a safe retry gets the same token back");
  assert.notEqual(a, b, "different checkout attempts get different tokens");

  const hash = hashTrackingToken(a);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes(a), "the stored value is not the raw token");
  assert.ok(!isWellFormedTrackingToken("../../etc/passwd"));
});

test("tracking tokens refuse to work without a strong secret", async () => {
  const { trackingTokenFor } = await import("@/lib/orders/tracking-token");
  const saved = process.env.TRACKING_TOKEN_SECRET;
  process.env.TRACKING_TOKEN_SECRET = "short";
  assert.throws(() => trackingTokenFor("3f6c2a1e-8b7d-4c5e-9f0a-1b2c3d4e5f60"), /TRACKING_TOKEN_SECRET/);
  process.env.TRACKING_TOKEN_SECRET = saved;
});
