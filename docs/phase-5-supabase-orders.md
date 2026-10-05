# Phase 5: Supabase real orders (design for review)

**Status: Phase 5A + 5A.1 hardening.** The migration has been tested only against a throwaway local PostgreSQL 17 (`npm run test:db`). **It has not been applied to the cloud Supabase project**, and nothing in the app talks to Supabase yet.

- Migration: [`supabase/migrations/20261005120000_phase5a_orders.sql`](../supabase/migrations/20261005120000_phase5a_orders.sql)
- Server code (not yet wired into the checkout): `src/lib/supabase/`, `src/lib/orders/`
- Tests: `tests/unit/` (`npm test`) and `tests/db/` (`npm run test:db`)

## 1. Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `orders` | One row per customer order | `id` uuid · `order_seq` identity · `order_number` "RN-0001" (generated) · `tracking_token_hash` (SHA-256, never the raw token) · `client_request_id` (idempotency key) + `request_fingerprint` · `order_type` · `status` · `customer_name` · `customer_phone` · `table_number` · `delivery_area_id` + `delivery_area_name` (snapshot) · `delivery_address` · `delivery_landmark` · `delivery_instructions` · `payment_method` · `notes` · `subtotal` · `delivery_fee` (as charged) · `total` · `created_at` · `updated_at` |
| `order_items` | Snapshot of each item bought | `order_id` · `line_number` · `product_key` · `product_name` · `category_name` · `size_name` · `base_price` · `options` jsonb · `addons` jsonb · `unit_price` · `quantity` · `notes` · `line_total` |
| `order_status_history` | Timeline and audit trail | `order_id` · `from_status` · `to_status` · `changed_at` · `changed_by` (admin user; null when the customer created it) |
| `store_settings` | Single row: ordering on/off, delivery on/off, ₱300 minimum, free from ₱500 | `ordering_enabled` · `delivery_enabled` · `delivery_min_order` · `free_delivery_from` |
| `delivery_areas` | Barangays with their own fee and on/off | `id` ('lourdes') · `name` · `fee` · `is_active` · `sort_order` |
| `admin_users` | Who may manage orders (Bam and staff) | `user_id` → `auth.users` · `display_name` |

The migration seeds the current rules: Lourdes ₱50, Salapungan ₱50, Batasan ₱70, Magumbali ₱70, Mandili ₱70, minimum ₱300, free from ₱500. The app keeps using `src/data/store-settings.ts` until the admin settings page exists.

### Built-in data checks

- `total = subtotal + delivery_fee`, and each item's `line_total = unit_price × quantity`.
- Dine in needs a table number. Take out and delivery need a mobile number (`09XXXXXXXXX`).
- Delivery needs an area, address and landmark. Only delivery orders may have a delivery fee or the status `out_for_delivery`.
- Text length limits match the app. Quantity is 1–20.

## 2. Relationships

```
auth.users ──1:1── admin_users
delivery_areas ──1:N── orders            (RESTRICT: an area used by orders can only be switched off)
orders ──1:N── order_items               (CASCADE)
orders ──1:N── order_status_history      (CASCADE)
auth.users ──1:N── order_status_history.changed_by (SET NULL)
```

Orders store `delivery_area_name` and the `delivery_fee` actually charged, so renaming an area or changing its fee never alters old orders (tested).

## 3. Order numbers (RN-0001)

- `order_seq` is an identity column: each value is handed out exactly once, even under simultaneous orders (tested with 25 parallel orders). It can't be set from outside.
- `order_number` is generated from it (`RN-0001` … `RN-9999`, then `RN-10000`) and can't be edited.
- A failed order may skip a number (a gap); numbers are never reused. The browser never creates the number.

## 4. Never trusting the browser

The browser sends **only ids and choices**: product id, size id, option ids, add-on ids, quantity, notes, customer details, a per-attempt idempotency key, and the total it showed (as a check only).

1. **Server (`src/lib/orders/build-order.ts`):** rebuilds every line from the menu, including name, category, size price, option price changes, add-on prices, unit price and subtotal. It then applies the delivery rules and computes the total. It rejects:
   - unknown products, sizes, options or add-ons, and add-ons not offered for that product;
   - duplicate choices, quantities outside 1–20, sold-out items or unavailable add-ons;
   - missing required choices, and invalid details or payment method;
   - a total different from what the customer saw (`total_changed`).

   Any extra price fields the browser sends are ignored (tested).
2. **Database (`create_order`):** re-checks what it can verify itself:
   - item arithmetic (`unit_price = base + options + add-ons`);
   - the subtotal;
   - the delivery rules: minimum, active area, and a fee it **computes from its own settings**;
   - `expected_total` must equal its own total.

   A fee or total the database didn't compute is rejected (tested).

## 5. One transaction, no partial orders

`create_order(p_order, p_items)` saves the order, all items and the first `received` history row (via trigger) in one transaction. Any error means nothing is saved; this is tested with an invalid second item, after which zero orders, items or history rows remain.

### Idempotency (duplicate guard)

- Each checkout attempt has a random `client_request_id`. The browser reuses it only to retry the *exact same* order and makes a new one as soon as anything changes (`CheckoutFlow.tsx`).
- The database stores a `request_fingerprint`, a SHA-256 of everything the customer chose. If the same key comes back:
  - same fingerprint → it returns the existing order (`is_new = false`), and the server gives back the same RN number and tracking token;
  - different fingerprint → `idempotency_key_reused`, and the original order is untouched.
- Simultaneous duplicates: the unique indexes make the second insert wait, then return the first's order. This is tested with 5 identical submissions at once, which produce exactly one order. It's also tested with two *different* payloads sharing one key: one wins and the other is rejected.

## 6. Tracking tokens

- **Raw token:** `base64url(HMAC-SHA256(TRACKING_TOKEN_SECRET, idempotency key))`, a 256-bit value that's unguessable without the server secret. A safe retry recomputes the same token, so the customer gets the same link back.
- **Stored:** only `SHA-256(raw token)`. The raw token goes to the customer once, after the order is saved, and is never stored or logged (tested: the raw token appears nowhere in the order row).
- **Lookup:** the server hashes the raw token, then calls `get_order_tracking(hash)` (service role only).
- **Response:** a safe summary of the order number, first name, order type, status, table number, payment method, items, totals and timeline. It contains **no phone, address, landmark, delivery instructions, full name or internal ids** (tested).

## 7. Status changes

Admins change status only through **`update_order_status(order_id, expected_current_status, new_status)`**. In one transaction it:

1. checks the caller is an admin;
2. locks the order;
3. checks the order is still in the status the admin's screen showed (otherwise `status_changed`, so two staff can't overwrite each other);
4. checks the transition is allowed;
5. updates the status, with the trigger writing the history row and the admin's id.

Allowed transitions (`is_valid_status_transition`):

| From | To |
| --- | --- |
| received | confirmed, cancelled |
| confirmed | preparing, cancelled |
| preparing | ready, cancelled; delivery also out_for_delivery |
| ready | dine in / take out: completed, cancelled · delivery: out_for_delivery, cancelled |
| out_for_delivery | completed |
| completed, cancelled | (final) |

A `BEFORE UPDATE` trigger enforces the same rules on **every** update, even by the service role or a manual SQL edit (tested), so `completed → preparing` can't be saved by any path. If Bam wants different cancellation rules (for example cancelling an order already out for delivery), it's a one-line change in `is_valid_status_transition`.

## 8. Security (RLS + privileges)

RLS is on for every table, and Supabase's default grants are narrowed explicitly. All of the following is tested against Supabase's real default grants, emulated locally.

| Who | orders / items / history | settings, areas | Functions |
| --- | --- | --- | --- |
| **Customer** (anon key) | **No access** (permission denied for list, read by UUID, update) | Read active areas and settings; no writes | none: `create_order`, `update_order_status` and `get_order_tracking` are all denied |
| **Next.js server** (service role, server-only) | Writes only via `create_order` | — | `create_order`, `get_order_tracking` |
| **Signed-in non-admin** | Sees 0 orders; can't update, insert or delete | Read only (updates affect 0 rows) | `update_order_status` → `not_authorized` |
| **Admin** (in `admin_users`) | Reads all; no direct update or delete (permission denied) | Read and edit | `update_order_status` (valid transitions only) |

- **Service-role key:** stored in `SUPABASE_SERVICE_ROLE_KEY`, with no `NEXT_PUBLIC_` prefix.
  - It's used only in `src/lib/supabase/service.ts`, which has `import "server-only"`, so importing it from client code fails the build.
  - The key is never logged; errors log only the database error code.
  - `.env.local` is git-ignored.
- **SECURITY DEFINER functions** use `set search_path = ''` and fully qualified names.

## 9. Placing an order (Phase 5B)

```
Place Order → Server Action → placeOrder(input)      [src/lib/orders/place-order.ts, server only]
   not configured (no keys) → "not_connected" (today's test mode)
   buildOrder()  → rebuild + validate from the menu (rejects bad input)
   tracking token = HMAC(secret, idempotency key); send only its hash
   supabase.rpc("create_order")  → one DB transaction
   ← { orderNumber, total, trackingToken } or a friendly error message
Browser: success → clear cart + this visit's choices → "Order Received! ☕ #RN-0042"
         failure → message shown; cart and form untouched; retry reuses the same key
```

## 10. Local tests

- `npm test` runs 40 unit tests for server-side order building and tracking tokens.
- `npm run test:db` runs 40 database tests on a throwaway **PostgreSQL 17** (`embedded-postgres`, a dev dependency).
  - The server starts on 127.0.0.1 with its data in git-ignored `.test-db/`, applies `tests/db/supabase-shim.sql` (Supabase's roles, `auth.uid()` and default grants) and then the migration, and deletes everything afterwards.
  - It **never contacts the cloud**.
  - It doesn't include Supabase's HTTP layer (PostgREST), which is covered when connecting in 5B.

## 11. Known limits / later

- **Spam orders:** anyone with the link can order (as with any no-login QR menu). Admins can cancel junk orders; a rate limit can be added in `placeOrder`.
- **Realtime** for the admin and kitchen screens comes in Phase 7.
- **Secret rotation:** changing `TRACKING_TOKEN_SECRET` invalidates existing tracking links (orders are unaffected).
