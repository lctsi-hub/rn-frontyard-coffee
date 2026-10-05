"use server";

// Staff order actions used by the live board, kitchen screen and order history.
import { addOrderItem } from "@/lib/orders/add-order-item";

/** Add an item to an existing open order. The server prices it; see addOrderItem(). */
export async function addOrderItemAction(input: unknown) {
  return addOrderItem(input);
}
