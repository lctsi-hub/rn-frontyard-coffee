// The customer's tracking data, parsed from get_order_tracking(). Only safe
// fields exist here: no full name, phone, address, landmark, instructions or ids.
import type { OrderType, PaymentMethodId } from "@/types/order";
import type { OrderStatus } from "./status";

export type TrackingItem = {
  name: string;
  size: string | null;
  options: string[];
  addons: string[];
  quantity: number;
  notes: string;
  lineTotal: number;
};

export type TrackingOrder = {
  orderNumber: string;
  firstName: string;
  orderType: OrderType;
  status: OrderStatus;
  tableNumber: number | null;
  paymentMethod: PaymentMethodId;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: TrackingItem[];
  timeline: Array<{ status: OrderStatus; at: string }>;
};

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export function parseTracking(data: unknown): TrackingOrder | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Json;
  if (typeof d.order_number !== "string") return null;
  return {
    orderNumber: d.order_number,
    firstName: str(d.customer_first_name),
    orderType: d.order_type as OrderType,
    status: d.status as OrderStatus,
    tableNumber: typeof d.table_number === "number" ? d.table_number : null,
    paymentMethod: d.payment_method as PaymentMethodId,
    subtotal: num(d.subtotal),
    deliveryFee: num(d.delivery_fee),
    total: num(d.total),
    createdAt: str(d.created_at),
    items: arr(d.items).map((i) => ({
      name: str(i.name),
      size: typeof i.size === "string" ? i.size : null,
      options: arr(i.options).map((o) => str(o.name)).filter(Boolean),
      addons: arr(i.addons).map((a) => str(a.name)).filter(Boolean),
      quantity: num(i.quantity),
      notes: str(i.notes),
      lineTotal: num(i.line_total),
    })),
    timeline: arr(d.timeline).map((t) => ({ status: t.status as OrderStatus, at: str(t.at) })),
  };
}
