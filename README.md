# RN Frontyard Coffee: QR Ordering

Mobile-first QR ordering web app for **RN Frontyard Coffee**, Lourdes, Candaba, Pampanga. Built with Next.js (App Router), TypeScript and Tailwind CSS v4.

QR orders will go straight into this app's own admin dashboard, where Bam (the owner) views and manages them. There is no external POS integration.

## Status

- **Phase 1 (done):** welcome page, branding, table QR support.
- **Phase 2–3 (done):** real menu, product customisation sheet, local cart, floating cart button, cart page.
- **Phase 4 (done, test mode):** checkout covering Dine In / Take Out / Delivery, customer details, delivery fee, payment method, order summary and confirmation. **Place Order doesn't send anything yet.** It shows a "test mode" notice until the order database is connected (next phase).
- Not connected: database (Supabase), admin dashboard, order tracking.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (this computer only)
npm run dev:phone    # also reachable from phones on the same Wi-Fi
```

With `dev:phone`, open `http://<this-computer's-LAN-IP>:3000` on your phone. Windows may ask to allow Node.js through the firewall; allow it on **Private** networks only.

## Routes

| URL | What it shows |
| --- | --- |
| `/` | Animated welcome screen with **Start Your Order** |
| `/order` | Menu |
| `/order?table=5` | Menu with "You're ordering for Table 5" (table QR codes) |
| `/order/cart` | Cart |
| `/order/checkout` | Checkout: order type → details → payment → review |

`?table=5` is kept on every link. Table numbers 1–99 are accepted; anything else is ignored. Opening checkout from a table link pre-selects Dine In for that table.

## Editing the menu

`src/data/menu-data.ts` holds the menu from the shop's printed boards (copies in `assets/menu-boards/`). The top of the file explains each field: prices, sizes (16oz/22oz, Solo/Duo), add-ons, sold out, featured, photos.

**Product photos:**

- `src/data/menu-photos.ts` sets which photo each product shows, one line per product. Lines marked `exact` are photos of that item; the rest are the closest stand-in (same type or colour).
- The originals are in `assets/photos/`, the crops are listed in `scripts/prepare-menu-photos.mjs`, and `npm run menu:photos` writes them to `public/menu/`.

## Store settings (delivery, payment)

`src/data/store-settings.ts` (later the admin Settings page):

- `delivery.enabled`: on/off. When off, customers see "Delivery is currently unavailable. Please choose Dine In or Take Out."
- `delivery.baseFee`: ₱50 for nearby areas (Lourdes, Salapungan).
- `delivery.farAreaSurcharge`: +₱20 for areas marked `isFarArea: true` (Batasan, Magumbali, Mandili), so ₱70 there.
- `delivery.minimumOrder`: ₱300. Below it, Delivery is shown but disabled, with "Delivery is available for orders worth ₱300 and above."
- `delivery.freeDeliveryFrom`: ₱500. From this subtotal, delivery is FREE in every area.
- `delivery.areas`: barangays we deliver to; `isActive: false` hides one.
- `paymentMethods`: Cash, GCash and Pay at Counter, each with on/off and which order types it applies to. Pay at Counter isn't offered for delivery.
- `gcash.qrImageUrl`: the shop QR (from `assets/payments/gcash-instapay-qr.png`, enlarged by `npm run menu:photos`). Customers see it with the amount to pay and a "Save QR image" button. Optional `accountName`/`accountNumber` are shown too when filled in.

## How data is kept on the customer's phone

- **Cart:** `localStorage`, cleared after 12 hours untouched. It stores only ids and quantities; names, prices and sold-out status always come from the current menu.
- **Name, mobile and address:** remembered on that phone for next time (`localStorage`, 90 days).
- **Order type, table, payment choice and notes:** only for the current visit (`sessionStorage`), so an old table number never carries over.
- When placing an order, the browser sends only ids and customer details (`OrderRequest` in `src/types/order.ts`). The server will recompute all prices itself.

## Where things live

```
src/app/                         routes (order/ = menu, cart, checkout)
src/components/menu/             product cards, featured row, category chips, product sheet
src/components/cart/             floating cart bar, cart page
src/components/checkout/         checkout steps + flow
src/components/ui/               form fields, quantity stepper, confirm dialog
src/data/menu-data.ts            the menu
src/data/store-settings.ts       delivery / payment settings
src/lib/pricing.ts               item prices + validation
src/lib/checkout.ts              phone numbers, delivery fees, checkout validation
src/services/orders/             submitOrder(): stub until the database phase
src/stores/                      cart + checkout form (browser storage)
scripts/                         logo and menu-photo preparation
```

## Environment

Copy `.env.example` to `.env.local` when Supabase is connected. Never commit real keys, and never give the secret key a `NEXT_PUBLIC_` prefix.
