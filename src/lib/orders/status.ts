// Order status vocabulary shared by the customer tracking page, the admin board
// and the kitchen screen. Mirrors is_valid_status_transition() in the database,
// which remains the authority (it rejects anything not allowed here).
import type { OrderType } from "@/types/order";

export type OrderStatus =
  | "received"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export const ACTIVE_STATUSES: OrderStatus[] = ["received", "confirmed", "preparing", "ready", "out_for_delivery"];
export const FINAL_STATUSES: OrderStatus[] = ["completed", "cancelled"];

export const ORDER_TYPE_NAMES: Record<OrderType, string> = {
  dine_in: "Dine In",
  take_out: "Take Out",
  delivery: "Delivery",
};

export function statusLabel(type: OrderType, status: OrderStatus): string {
  switch (status) {
    case "received":
      return "Received";
    case "confirmed":
      return "Confirmed";
    case "preparing":
      return "Preparing";
    case "ready":
      return type === "dine_in" ? "Ready to Serve" : type === "take_out" ? "Ready for Pickup" : "Ready for Rider";
    case "out_for_delivery":
      return "Out for Delivery";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

/** The customer's timeline. Delivery skips "ready" (the kitchen may still use it). */
export function customerStages(type: OrderType): OrderStatus[] {
  return type === "delivery"
    ? ["received", "confirmed", "preparing", "out_for_delivery", "completed"]
    : ["received", "confirmed", "preparing", "ready", "completed"];
}

/** Position of the current status on the customer's timeline. */
export function customerStageIndex(type: OrderType, status: OrderStatus): number {
  if (type === "delivery" && status === "ready") return customerStages(type).indexOf("preparing");
  return customerStages(type).indexOf(status);
}

export function customerMessage(type: OrderType, status: OrderStatus, tableNumber: number | null): string {
  switch (status) {
    case "received":
      return "We've received your order and will confirm it shortly.";
    case "confirmed":
      return "Your order is confirmed. We'll start preparing it soon.";
    case "preparing":
      return "Our baristas and kitchen are preparing your order.";
    case "ready":
      if (type === "dine_in") return tableNumber ? `Your order is ready! We're bringing it to Table ${tableNumber}.` : "Your order is ready to serve!";
      if (type === "take_out") return "Your order is ready! Please pick it up at the counter.";
      return "Your order is packed and waiting for our rider.";
    case "out_for_delivery":
      return "Your order is on its way!";
    case "completed":
      return "Order completed. Thank you for ordering from RN Frontyard Coffee!";
    case "cancelled":
      return "This order was cancelled. If you have questions, please contact the shop.";
  }
}

export type StatusAction = { to: OrderStatus; label: string };

/** Staff's main "next step" button for an order (admin board). */
export function nextAction(type: OrderType, status: OrderStatus): StatusAction | null {
  switch (status) {
    case "received":
      return { to: "confirmed", label: "Confirm" };
    case "confirmed":
      return { to: "preparing", label: "Start Preparing" };
    case "preparing":
      return type === "delivery"
        ? { to: "out_for_delivery", label: "Out for Delivery" }
        : { to: "ready", label: type === "dine_in" ? "Ready to Serve" : "Ready for Pickup" };
    case "ready":
      return type === "delivery" ? { to: "out_for_delivery", label: "Out for Delivery" } : { to: "completed", label: "Complete" };
    case "out_for_delivery":
      return { to: "completed", label: "Delivered" };
    default:
      return null;
  }
}

/** Kitchen/bar screen: confirm → prepare → ready (delivery continues on the admin board). */
export function kitchenAction(status: OrderStatus): StatusAction | null {
  switch (status) {
    case "received":
      return { to: "confirmed", label: "Confirm" };
    case "confirmed":
      return { to: "preparing", label: "Start Preparing" };
    case "preparing":
      return { to: "ready", label: "Ready" };
    default:
      return null;
  }
}

/** Cancelling is allowed until the order leaves the shop (matches the database). */
export function canCancel(status: OrderStatus) {
  return status === "received" || status === "confirmed" || status === "preparing" || status === "ready";
}
