# Phase 5: Supabase real orders (design for review)

**Status: Phase 5A, design only.** Nothing has been run against Supabase. The migration file is written but **not applied**.

- Migration: [`supabase/migrations/20261005120000_phase5a_orders.sql`](../supabase/migrations/20261005120000_phase5a_orders.sql)
- App code prepared (not yet used by any page): `src/lib/supabase/`

## 1. Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `orders` | One row per customer order | `id` uuid · `order_seq` identity · `order_number` "RN-0001" (generated) · `tracking_token` uuid (secret) · `client_request_id` uuid (de-duplication) · `order_type` · `status` · `customer_name` · `customer_phone` · `table_number` · `delivery_area_id` + `delivery_area_name` · `delivery_address` · `delivery_landmark` · `delivery_instructions` · `payment_method` · `notes` · `subtotal` · `delivery_fee` · `total` · `created_at` · `updated_at` |
| `order_items` | Snapshot of each item bought | `order_id` · `line_number` · `product_key` · `product_name` · `category_name` · `size_name` · `base_price` · `options` jsonb · `addons` jsonb · `unit_price` · `quantity` · `notes` · `line_total` |
| `order_status_history` | Timeline and audit trail | `order_id` · `from_status` · `to_status` · `changed_at` · `changed_by` (admin user, null for the customer) |
| `store_settings` | Single row: ordering on/off, delivery on/off, ₱300 minimum, free from ₱500 | `ordering_enabled` · `delivery_enabled` · `delivery_min_order` · `free_delivery_from` |
| `delivery_areas` | Barangays with their own fee and on/off | `id` ('lourdes') · `name` · `fee` · `is_active` · `sort_order` |
| `admin_users` | Who may manage orders (Bam and staff) | `user_id` → `auth.users` · `display_name` |

The enums are `order_type` (dine_in, take_out, delivery), `order_status` (received, confirmed, preparing, ready, out_for_delivery, completed, cancelled) and `payment_method` (cash, gcash, counter).

The migration seeds the current rules: Lourdes ₱50, Salapungan ₱50, Batasan ₱70, Magumbali ₱70, Mandili ₱70, minimum ₱300, free from ₱500. The app keeps using `src/data/store-settings.ts` until the admin settings page exists.

### Built-in data checks (the database refuses bad rows)

- `total = subtotal + delivery_fee`, and each item's `line_total = unit_price × quantity`.
- Dine in needs a table number. Take out and delivery need a mobile number (format `09XXXXXXXXX`).
- Delivery needs an area, address and landmark. Only delivery orders may have a delivery fee or the status `out_for_delivery`.
- Text length limits match the app (name 60, address 160, landmark 120, notes 200/140). Quantity is 1–20.

## 2. Relationships

```
auth.users ──1:1── admin_users
delivery_areas ──1:N── orders            (on delete RESTRICT: an area used by orders can't be deleted, only switched off)
orders ──1:N── order_items               (on delete CASCADE)
orders ──1:N── order_status_history      (on delete CASCADE)
auth.users ──1:N── order_status_history.changed_by (on delete SET NULL)
store_settings: single row, no relations
```

`order_items` does not reference a menu table. It stores the product key, name, size, options, add-ons and prices as they were at order time, so later menu changes never alter old orders.

## 3. Order numbers (RN-0001)

- `order_seq` is a Postgres **identity** column. The database hands out each value exactly once, even when many customers order at the same moment, so there are no duplicates, and it can't be set from outside (`generated always`).
- `order_number` is a **generated column**: `'RN-' || lpad(order_seq, 4, '0')`, giving RN-0001 … RN-9999, then RN-10000 (it never truncates). Nobody can edit it.
- If an order fails to save after a number was drawn, that number is skipped (a gap). This is normal and harmless; numbers are never reused.
- The browser never creates the number; it receives it after the save succeeds.

## 4. Saving an order in one transaction

All writes go through **`create_order(p_order, p_items)`**, a database function. One function call is one transaction: the order row, every item row, and the first "received" history row (added by trigger) are saved together, or nothing is saved.

Before inserting, the function re-checks what the database can verify on its own:

- Ordering is enabled, the order has 1–50 lines, and each item's `unit_price` equals base + options + add-ons.
- It recomputes the subtotal from the items.
- **Delivery:** it checks delivery is on, the subtotal is at least the minimum, and the area is active. It then sets the fee itself (area fee, or ₱0 from the free threshold) and computes the total.

Errors come back as short codes (`delivery_below_minimum`, `delivery_area_invalid`, `ordering_closed`, `item_price_mismatch`, …) for the app to turn into friendly messages.

**No duplicate orders on double tap or retry:** each checkout attempt sends a random `client_request_id`.

- If that id is already saved, the function returns the existing order instead of creating another.
- If two identical requests arrive at the same instant, the unique index makes the second wait for the first and then return the first's order.

### Status history

A trigger on `orders` writes `order_status_history` on insert (`null → received`) and on every status change (`from → to`, with the admin's user id). The app never writes history directly, so the timeline can't get out of sync with the order.

## 5. Security (Row Level Security)

RLS is **on for every table**. Supabase's default table and function grants are narrowed explicitly, so a forgotten policy is never the only protection.

| Who | orders / order_items / history | store_settings, delivery_areas | Functions |
| --- | --- | --- | --- |
| **Customer** (anon key in the browser) | **No access at all**: can't list, read, insert, update or delete. | Read only (active areas only) | `get_order_tracking(token)` only |
| **Our Next.js server** (service role, server-only) | Writes only through `create_order()` | — | `create_order()` (granted to service_role only) |
| **Admin** (signed in, listed in `admin_users`) | Read all; update **only the `status` column**; no delete | Read all; edit settings and areas | `is_admin()`, `get_order_tracking()` |
| Signed-in non-admin | Nothing | Read only | — |

- **Customer tracking:** the customer gets a secret `tracking_token` (random UUID) after ordering. `get_order_tracking(token)` returns only that one order's number, status, items, totals, timeline and first name. It returns **no phone number or address**, and there is no way to list or guess other orders.
- **Admins:** Bam signs in with Supabase Auth, then is added to `admin_users` by hand in the Supabase dashboard. The app has no "make me admin" path. Admins can change status but not prices, items or customer details (column-level grant).
- **Functions:** `SECURITY DEFINER` functions run with `search_path = ''` and fully qualified names, which is the standard protection against search-path hijacking.

## 6. Placing an order (Phase 5B plan)

```
Place Order (confirm dialog)
  → Server Action placeOrder(request)          [src/app/order/checkout/actions.ts, server only]
      1. validate shape: types, lengths, ids, client_request_id
      2. load the menu + settings ON THE SERVER; re-price every line with
         src/lib/pricing.ts; reject sold-out items, missing choices,
         unknown add-ons (browser prices are never trusted)
      3. validate checkout details with src/lib/checkout.ts (same rules as the UI)
      4. build the snapshot (names, sizes, options, add-ons, prices)
      5. supabase.rpc("create_order", …)  ← ONE transaction in the database
      6. map error codes → friendly message
  ← { ok: true, orderNumber: "RN-0042", trackingToken } | { ok: false, message }
Browser:
  ok    → clear the cart + this visit's checkout choices (contact details stay)
          → "Order Received! ☕ Order #RN-0042" screen → tracking (Phase 6)
  error → show the message; cart and form untouched; customer can retry
          (same client_request_id, so a retry after a timeout can't duplicate)
```

The cart is cleared only after the database confirms the save. On any failure nothing is saved, thanks to the single transaction.

### Decision needed: the server credential

The menu still lives in code (`src/data/menu-data.ts`), not in the database, so **only our server can verify item prices**. That rules out letting the browser's anon key call `create_order` directly: anyone could call it with made-up prices.

- **Option A (recommended):** a server-only `SUPABASE_SERVICE_ROLE_KEY` (Supabase's newer "secret key" also works) in `.env.local` and Vercel. No `NEXT_PUBLIC_` prefix, so it never reaches the browser, and it's used only in one `import "server-only"` file (`src/lib/supabase/admin.ts`, created in 5B). `create_order` is executable by the service role only.
- **Option B:** no service key, with `create_order` granted to anon. This is simpler, but prices can't be verified against the menu until the menu moves into the database (the menu-management phase). Not recommended for real orders.

## 7. Phase 5B steps (after approval)

1. **(Recommended) Test the migration in a throwaway local Postgres** (in-memory, no Supabase), with automated checks:
   - parallel orders get unique RN numbers;
   - a failing item rolls back the whole order;
   - a double submit returns one order;
   - anon can't read orders;
   - an admin can only change status.
2. You apply the migration in the Supabase SQL editor (or I do it via the Supabase CLI, only with your explicit go-ahead).
3. You add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ the server key if Option A) to `.env.local`.
4. Build `placeOrder` as above, replacing the test-mode `submitOrder`, plus the Order Received screen.
5. Regenerate `src/lib/supabase/database.types.ts` from the real database.

## 8. Known limits / later

- **Spam orders:** anyone with the site can place orders (as with any no-login QR menu). Admins can cancel junk orders. A simple rate limit can be added in `placeOrder` later.
- **Status transitions:** the database allows any status change, so Bam can fix mistakes. The admin UI (Phase 7) will offer only sensible next steps.
- **Realtime updates** for the admin and kitchen screens will be added in Phase 7 (Supabase Realtime on `orders`, admins only).
- `orders.delivery_fee` stores the fee actually charged. Free-delivery orders store ₱0, and the area's normal fee is still visible in `delivery_areas`.
