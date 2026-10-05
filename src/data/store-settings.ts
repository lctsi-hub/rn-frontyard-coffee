// =============================================================================
// STORE SETTINGS — defaults and code-only settings
//
// Ordering on/off and all DELIVERY rules now live in the database and are
// edited by Bam in Admin → Settings (tables store_settings + delivery_areas).
// The values below are only the fallback used when the database can't be
// reached (and in tests); they match the database's initial values:
//   Lourdes ₱50 · Salapungan ₱50 · Batasan ₱70 · Magumbali ₱70 · Mandili ₱70
//   delivery minimum ₱300 · free delivery from ₱500
//
// Payment methods and GCash details are still edited here.
// =============================================================================
import type { StoreSettings } from "@/types/order";

export const localStoreSettings: StoreSettings = {
  ordering: {
    enabled: true,
  },

  delivery: {
    enabled: true,
    minimumOrder: 300,
    freeDeliveryFrom: 500,
    areas: [
      { id: "lourdes", name: "Lourdes", fee: 50, isActive: true },
      { id: "salapungan", name: "Salapungan", fee: 50, isActive: true },
      { id: "batasan", name: "Batasan", fee: 70, isActive: true },
      { id: "magumbali", name: "Magumbali", fee: 70, isActive: true },
      { id: "mandili", name: "Mandili", fee: 70, isActive: true },
    ],
  },

  paymentMethods: [
    {
      id: "cash",
      label: "Cash",
      description: "Pay with cash when you get your order.",
      enabled: true,
      orderTypes: ["dine_in", "take_out", "delivery"],
    },
    {
      id: "gcash",
      label: "GCash",
      description: "Scan or upload our QR code in GCash.",
      enabled: true,
      orderTypes: ["dine_in", "take_out", "delivery"],
    },
    {
      id: "counter",
      label: "Pay at Counter",
      description: "Pay at the counter before or after your order.",
      enabled: true,
      orderTypes: ["dine_in", "take_out"],
    },
  ],

  // Shown when the customer picks GCash. qrImageUrl is made by `npm run menu:photos`
  // from assets/payments/gcash-instapay-qr.png. Fill in the name/number to show them too.
  gcash: {
    accountName: null,
    accountNumber: null,
    qrImageUrl: "/payments/gcash-qr.png",
  },
};
