// Checkout + store-setting shapes. They mirror the planned database tables
// (store_settings, delivery_areas, payment_methods, orders).
import type { ItemSelection } from "@/lib/pricing";

export type OrderType = "dine_in" | "take_out" | "delivery";

export type PaymentMethodId = "cash" | "gcash" | "counter";

export type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  description: string;
  enabled: boolean;
  /** Order types this method can be used for. */
  orderTypes: OrderType[];
};

export type DeliveryArea = {
  id: string;
  name: string;
  /** Normal delivery fee for this area, in pesos (before the free-delivery rule). */
  fee: number;
  isActive: boolean;
};

export type StoreSettings = {
  ordering: {
    /** Turn off to stop accepting QR orders (e.g. when closed). */
    enabled: boolean;
  };
  delivery: {
    enabled: boolean;
    /** Delivery is only allowed when the order subtotal is at least this. */
    minimumOrder: number;
    /** Orders with a subtotal of at least this get free delivery; null = never free. */
    freeDeliveryFrom: number | null;
    areas: DeliveryArea[];
  };
  paymentMethods: PaymentMethod[];
  gcash: {
    accountName: string | null;
    accountNumber: string | null;
    /** Path of an uploaded GCash QR image, e.g. "/payments/gcash-qr.png". */
    qrImageUrl: string | null;
  };
};

/**
 * What the browser sends when placing an order: ids and customer details only.
 * The server looks up names and prices itself and recomputes every total,
 * including the delivery minimum, fee and free-delivery rule.
 */
export type OrderRequest = {
  /** Random UUID per checkout attempt (idempotency key); reused only for a retry of the same order. */
  clientRequestId: string;
  /** Total the customer saw. Never used as a price; the order is rejected if the real total differs. */
  expectedTotal: number;
  orderType: OrderType;
  tableNumber: number | null;
  customer: { name: string; phone: string | null };
  delivery: { areaId: string; address: string; landmark: string; instructions: string } | null;
  paymentMethod: PaymentMethodId;
  notes: string;
  items: ItemSelection[];
};
