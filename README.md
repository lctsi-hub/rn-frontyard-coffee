# RN Frontyard Coffee: QR Ordering

Mobile-first QR ordering web app for **RN Frontyard Coffee**, Lourdes, Candaba, Pampanga. Built with Next.js (App Router), TypeScript, Tailwind CSS v4 and Supabase.

QR orders go straight into this app's own admin dashboard, where Bam (the owner) views and manages them. There is no external POS integration.

## Status

- **Phases 1–4 (done):** welcome page, real menu and photos, customisation, cart, checkout (Dine In / Take Out / Delivery, delivery fees, GCash QR).
- **Phase 5 (done, on branch `feature/phase-5-supabase-orders`, not deployed):** real orders saved in Supabase, Order Received page, customer tracking link, staff login, live orders board with sound alerts, kitchen screen, order history, settings (ordering ON/OFF, delivery rules and fees), menu Available/Sold out switches, table QR codes. Design notes: [docs/phase-5-supabase-orders.md](docs/phase-5-supabase-orders.md).
- **Database migrations** (`supabase/migrations/`, applied in order in the Supabase SQL Editor):
  1. `20261005120000_phase5a_orders.sql` (orders, settings, security): **applied**.
  2. `20261006090000_menu_availability_and_realtime.sql` (sold-out switches + instant live board): **still to be applied by hand.** Until then the menu uses the code defaults, the admin Menu page shows a notice, and the live board refreshes every 30 seconds instead of instantly.
  3. `20261006120000_add_items_to_orders.sql` (staff add items to an existing order, audit trail, kitchen "NEW" marks): **still to be applied by hand, after migration 2.** Until then "+ Add Item" answers that the database update is needed; nothing else changes.
- Not built: editing menu names, prices or photos from the dashboard (still done in `src/data/menu-data.ts`).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (this computer only)
npm run dev:phone    # also reachable from phones on the same Wi-Fi
```

With `dev:phone`, open `http://<this-computer's-LAN-IP>:3000` on your phone. Windows may ask to allow Node.js through the firewall; allow it on **Private** networks only.

## Routes

| URL | Who | What it shows |
| --- | --- | --- |
| `/` | Customers | Animated welcome screen with **Start Your Order** |
| `/order` | Customers | Menu (`/order?table=5` shows "You're ordering for Table 5") |
| `/order/cart` | Customers | Cart |
| `/order/checkout` | Customers | Checkout: order type → details → payment → review → Place Order |
| `/order/received` | Customers | "Order Received! ☕" with the order number and **Track My Order** |
| `/track/<token>` | Customers | Order status (private link, refreshes every 15 seconds) |
| `/admin/login` | Staff | Sign in (no sign-up; accounts are created in Supabase) |
| `/admin` | Staff | Live orders board, Active Tables, + Add Item / + Rice / + Kimchi, today's totals, new-order sound alert |
| `/admin/orders` | Staff | Order history: date, type and status filters, search by RN number, totals |
| `/admin/menu` | Staff | Available / Sold out switches for every product and add-on |
| `/admin/settings` | Staff | Online ordering ON/OFF, delivery ON/OFF, minimum order, free delivery, barangay fees |
| `/admin/qr` | Staff | Printable QR codes for the shop and each table (PNG/SVG download) |
| `/kitchen` | Staff | Big-card kitchen screen: Confirm → Start Preparing → Ready, NEW / ADDED items with Got it |

`?table=5` is kept on every customer link. Table numbers 1–99 are accepted; anything else is ignored. Opening checkout from a table link pre-selects Dine In for that table. Every `/admin` and `/kitchen` page requires a signed-in user listed in `admin_users`.

## Staff accounts

There is no public sign-up. To add a staff member (for example Bam):

1. Supabase → **Authentication → Users → Add user → Create new user**: email and password, with **Auto Confirm User** ticked.
2. Copy the new user's **UID**.
3. Supabase → **SQL Editor**: `insert into public.admin_users (user_id, display_name) values ('<UID>', 'Bam');`
4. Recommended once: in the Authentication settings, turn off **Allow new users to sign up**.

To remove access: `delete from public.admin_users where user_id = '<UID>';` (and delete the user under Authentication).

## Order status flow

- Dine In / Take Out: Received → Confirmed → Preparing → Ready → Completed.
- Delivery: Received → Confirmed → Preparing → (Ready) → Out for Delivery → Completed.

Staff can cancel an order (after a confirmation) up to Ready, but not once it is out for delivery or completed. The database enforces these rules, so the buttons can't skip steps.

## Adding items to an existing order

A customer at Table 5 asks for one more rice: staff add it to the **same** order (same RN number, same table), no new order.

- **Where:** "+ Add Item" on every open order (live board, kitchen screen, order history). Open dine-in orders also have one-tap **+ Rice** and **+ Kimchi** buttons, which ask "Add Extra Rice ×1? to Table 5 / RN-0012" first. The **Active Tables** box on the live board lists each table's open order; tap one to jump to it.
- **When:** while the order is Received, Confirmed, Preparing or Ready. Never after it is out for delivery, completed or cancelled.
- **Prices:** the sheet only previews the price. The server rebuilds the item from the menu (sold-out switches included), and the database adds it with its own price snapshot, updates subtotal / total (delivery becomes free if the new subtotal reaches the free-delivery amount), and records "Extra Rice ×1 added by Bam" with the time. Earlier items are never changed. A double tap adds the item once.
- **Quick Extras** (Extra Rice, Kimchi, Egg, Cheese Sauce) are listed in `quickExtras` in `src/data/menu-data.ts`. Each takes its price and Sold out state from an add-on, so change the add-on's price to change the extra's.
- **Payment:** the order card shows "Added after checkout" with the original total, added amount and new total, so staff know what to collect. GCash orders also show "Additional payment may need to be collected." Nothing is marked as paid automatically.
- **Kitchen:** added items show **NEW · ADDED** and a red "New items added" bar (with a chime when sound is on) until the kitchen taps **Got it** or the order moves to its next status.
- **Customer tracking** shows the added item and new total after the page refreshes. It never shows which staff member added it.

## Editing the menu

`src/data/menu-data.ts` holds the menu from the shop's printed boards (copies in `assets/menu-boards/`). The top of the file explains each field: prices, sizes (16oz/22oz, Solo/Duo), add-ons, featured, photos. Day-to-day "sold out" is switched on **/admin/menu** instead (after migration 2 is applied).

**Product photos:**

- `src/data/menu-photos.ts` sets which photo each product shows, one line per product. Lines marked `exact` are photos of that item; the rest are the closest stand-in (same kind of drink or dish).
- **Studio photos** (white background) are cut from the product photo sheets in `assets/menu-sheets/` by `npm run menu:sheets` (`scripts/prepare-menu-sheets.mjs`): label removed, product centred, 640×640, written to `public/menu/<label-name>.jpg`. To use a new sheet, replace the file and adjust its rows/names at the top of the script.
- A few **real shop photos** (strawberry milk, cheese sticks, cheese-overload sandwiches, pork enoki rice, the menu banner) are cropped from `assets/photos/` by `npm run menu:photos`.

## Store settings (delivery, payment)

Live settings are edited on **/admin/settings** and stored in Supabase (`store_settings`, `delivery_areas`):

- **Online ordering ON/OFF.** When OFF, customers can still browse the menu but see "Online ordering is currently unavailable. Please visit us again soon." and can't check out.
- **Delivery ON/OFF**, the **minimum order** (₱300), **free delivery from** (₱500, or switched off) and each barangay's **fee** (Lourdes and Salapungan ₱50; Batasan, Magumbali and Mandili ₱70). New barangays can be added; inactive ones are hidden.

`src/data/store-settings.ts` holds the same defaults and is used only if the database can't be reached. Payment methods (Cash, GCash, Pay at Counter) and the GCash QR (`public/payments/gcash-qr.png`) are still set in that file. The server recomputes every price and fee from these settings when an order is placed; prices sent by the phone are never trusted.

## How data is kept on the customer's phone

- **Cart:** `localStorage`, cleared after 12 hours untouched. It stores only ids and quantities; names, prices and sold-out status always come from the current menu.
- **Name, mobile and address:** remembered on that phone for next time (`localStorage`, 90 days).
- **Order type, table, payment choice and notes:** only for the current visit (`sessionStorage`), so an old table number never carries over.
- **Last order:** its order number and tracking link (`localStorage`, 24 hours), shown as a "Track #RN-…" shortcut on the menu.
- When placing an order, the browser sends only ids and customer details (`OrderRequest` in `src/types/order.ts`). The server recomputes all prices itself.

## Where things live

```
src/app/                         routes (order/, track/, admin/, kitchen/)
src/proxy.ts                     sends signed-out visitors of /admin and /kitchen to the login page
src/components/                  customer screens (menu, cart, checkout, order, tracking) and admin/
src/data/menu-data.ts            the menu
src/data/store-settings.ts       fallback delivery settings + payment methods
src/lib/orders/                  server pricing, placing orders, status rules, tracking
src/lib/auth/                    staff session checks
src/lib/supabase/                Supabase clients (the secret key is server-only)
src/stores/                      cart, checkout form, last order (browser storage)
supabase/migrations/             database schema
tests/unit, tests/db             unit tests and database tests
scripts/                         env checks, read-only cloud check, logo and photo preparation
```

## Checks

```bash
npm run lint
npm test               # unit tests
npm run test:db        # database tests on a throwaway local Postgres (applies every migration)
npm run env:check      # validates .env.local without printing values
npm run cloud:verify   # read-only check of the Supabase project (changes nothing)
```

## Environment

Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and `TRACKING_TOKEN_SECRET` (`npm run env:tracking-secret` generates one). Once the site is deployed, also set `NEXT_PUBLIC_SITE_URL` so the QR codes use the public address. Never commit real keys, and never give the secret key or tracking secret a `NEXT_PUBLIC_` prefix (the app refuses to start if you do).
