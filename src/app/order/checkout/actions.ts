"use server";

// Server Action behind Place Order. Everything the browser sends is treated
// as untrusted: placeOrder() rebuilds the order and prices from the menu and
// the database saves it in one transaction.
import { placeOrder, type PlaceOrderResult } from "@/lib/orders/place-order";

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  return placeOrder(input);
}
