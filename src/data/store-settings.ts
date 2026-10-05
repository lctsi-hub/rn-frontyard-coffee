// =============================================================================
// STORE SETTINGS (temporary local file)
// Becomes the admin "Settings" page later, so Bam can change these without a
// redeploy. Until then, edit here. All amounts are whole pesos.
//
// DELIVERY RULES (store is in Lourdes, Candaba, Pampanga)
//   enabled            false → customers can only choose Dine In or Take Out
//   baseFee            fee for nearby areas
//   farAreaSurcharge   added to baseFee for areas with isFarArea: true
//   minimumOrder       delivery only allowed when the subtotal is at least this
//   freeDeliveryFrom   subtotal at or above this → delivery is FREE (any area)
//   areas              barangays we deliver to; isActive: false hides one
//
// Examples with the values below:
//   ₱320 to Lourdes → ₱50   ₱320 to Mandili → ₱70   ₱500+ anywhere → FREE   below ₱300 → no delivery
// =============================================================================
import type { StoreSettings } from "@/types/order";

export const localStoreSettings: StoreSettings = {
  ordering: {
    enabled: true,
  },

  delivery: {
    enabled: true,
    baseFee: 50,
    farAreaSurcharge: 20,
    minimumOrder: 300,
    freeDeliveryFrom: 500,
    areas: [
      { id: "lourdes", name: "Lourdes", isFarArea: false, isActive: true },
      { id: "salapungan", name: "Salapungan", isFarArea: false, isActive: true },
      { id: "batasan", name: "Batasan", isFarArea: true, isActive: true },
      { id: "magumbali", name: "Magumbali", isFarArea: true, isActive: true },
      { id: "mandili", name: "Mandili", isFarArea: true, isActive: true },
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
