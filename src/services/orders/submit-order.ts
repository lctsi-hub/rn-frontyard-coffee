// Sends a customer's order to our own order system (the RN Frontyard admin
// dashboard). Not connected yet: the next phase replaces the body with a
// server action that re-checks prices and availability, saves the order with
// an RN-0012 style number, and returns it.
import type { OrderRequest } from "@/types/order";

export type SubmitOrderResult =
  | { ok: true; orderNumber: string; trackingToken: string }
  | { ok: false; reason: "not_connected" | "rejected"; message: string };

export async function submitOrder(request: OrderRequest): Promise<SubmitOrderResult> {
  void request;
  return {
    ok: false,
    reason: "not_connected",
    message: "Online ordering isn't connected yet. This was a test, and no order was sent to the shop.",
  };
}
