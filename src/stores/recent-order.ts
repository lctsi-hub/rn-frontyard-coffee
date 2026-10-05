// The customer's most recent placed order on this phone, for the Order Received
// screen and the "Track your order" shortcut on the menu. Holds the customer's
// own tracking token (their key to the tracking page), never any other data.
import { createLocalStore } from "@/lib/local-store";
import type { OrderType } from "@/types/order";

export type RecentOrder = {
  orderNumber: string;
  trackingToken: string;
  orderType: OrderType;
  total: number;
  tableNumber: number | null;
  placedAt: number;
};

const store = createLocalStore<RecentOrder | null>({
  key: "rnfc:recent-order:v1",
  initial: null,
  maxAgeMs: 24 * 60 * 60 * 1000,
  parse: (stored) => {
    const s = stored as Partial<RecentOrder> | null;
    if (!s || typeof s.orderNumber !== "string" || typeof s.trackingToken !== "string") return null;
    if (s.orderType !== "dine_in" && s.orderType !== "take_out" && s.orderType !== "delivery") return null;
    return {
      orderNumber: s.orderNumber,
      trackingToken: s.trackingToken,
      orderType: s.orderType,
      total: typeof s.total === "number" ? s.total : 0,
      tableNumber: typeof s.tableNumber === "number" ? s.tableNumber : null,
      placedAt: typeof s.placedAt === "number" ? s.placedAt : Date.now(),
    };
  },
});

export const useRecentOrder = store.useValue;
export const saveRecentOrder = (order: Omit<RecentOrder, "placedAt">) => store.set({ ...order, placedAt: Date.now() });
