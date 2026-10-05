import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath } from "@/lib/auth/redirect";

test("after sign-in, only staff pages are allowed as the next page", () => {
  assert.equal(safeNextPath("/admin/orders"), "/admin/orders");
  assert.equal(safeNextPath("/kitchen"), "/kitchen");
  for (const bad of ["https://evil.example", "//evil.example", "/admin/../order", "/order", "/admin/login", "javascript:alert(1)", "/admin?x=https://evil", null, 42]) {
    assert.equal(safeNextPath(bad), "/admin", String(bad));
  }
});
