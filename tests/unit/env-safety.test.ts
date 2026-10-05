// Secret keys must never end up public, and errors must never echo values.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { findPublicSecrets, isSupabaseSecretKey } from "../../scripts/env-safety.mjs";

const FAKE_SECRET = "sb_secret_FAKEfakeFAKEfakeFAKEfake0000";
const FAKE_PUBLISHABLE = "sb_publishable_FAKEfakeFAKEfake0000";
// Legacy JWT with {"role":"service_role"} payload (not a real key).
const LEGACY_SERVICE_JWT = `x.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.y`;
const LEGACY_ANON_JWT = `x.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.y`;

test("secret keys are recognised, publishable keys are not", () => {
  assert.equal(isSupabaseSecretKey(FAKE_SECRET), true);
  assert.equal(isSupabaseSecretKey(LEGACY_SERVICE_JWT), true);
  assert.equal(isSupabaseSecretKey(FAKE_PUBLISHABLE), false);
  assert.equal(isSupabaseSecretKey(LEGACY_ANON_JWT), false);
});

test("a correct .env has no public secrets", () => {
  assert.deepEqual(
    findPublicSecrets({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: FAKE_PUBLISHABLE,
      SUPABASE_SECRET_KEY: FAKE_SECRET,
      TRACKING_TOKEN_SECRET: "t".repeat(43),
    }),
    [],
  );
});

test("swapped keys or a public copy of a secret are caught (names only)", () => {
  const found = findPublicSecrets({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: FAKE_SECRET,
    NEXT_PUBLIC_OTHER: "t".repeat(43),
    NEXT_PUBLIC_OLD_KEY: LEGACY_SERVICE_JWT,
    SUPABASE_SECRET_KEY: FAKE_PUBLISHABLE,
    TRACKING_TOKEN_SECRET: "t".repeat(43),
  });
  assert.deepEqual(found.sort(), ["NEXT_PUBLIC_OLD_KEY", "NEXT_PUBLIC_OTHER", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
  assert.ok(!JSON.stringify(found).includes("sb_secret_"), "only names are returned");
});

const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY };
afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
  process.env.SUPABASE_SECRET_KEY = saved.secret;
  if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (saved.secret === undefined) delete process.env.SUPABASE_SECRET_KEY;
});

test("privileged client refuses a missing or publishable secret key, without echoing values", async () => {
  const { createSupabaseServiceClient, isSecretKeyConfigured } = await import("@/lib/supabase/service");
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  assert.equal(isSecretKeyConfigured(), false);
  assert.throws(() => createSupabaseServiceClient(), (e: Error) => /SUPABASE_SECRET_KEY/.test(e.message));

  process.env.SUPABASE_SECRET_KEY = FAKE_PUBLISHABLE;
  assert.throws(
    () => createSupabaseServiceClient(),
    (e: Error) => /publishable key/.test(e.message) && !e.message.includes(FAKE_PUBLISHABLE),
  );

  process.env.SUPABASE_SECRET_KEY = FAKE_SECRET;
  assert.equal(isSecretKeyConfigured(), true);
  assert.doesNotThrow(() => createSupabaseServiceClient()); // creating a client makes no network request
});
