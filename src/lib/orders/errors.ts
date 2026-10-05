// Error codes for placing an order, shared by the server-side builder and the
// database (create_order raises the same codes), with the message the
// customer sees for each.

export const ORDER_ERROR_MESSAGES = {
  not_connected: "Online ordering isn't connected yet. This was a test, and no order was sent to the shop.",
  ordering_closed: "We're not taking online orders right now. Please order at the counter.",
  invalid_order: "Something in your order couldn't be read. Please review it and try again.",
  invalid_item: "Something in your cart couldn't be read. Please review your cart and try again.",
  empty_order: "Your cart is empty.",
  too_many_items: "That's a lot of items! Please split your order or order at the counter.",
  item_unavailable: "Some items in your cart are no longer available. Please update your cart.",
  invalid_details: "Please check your details and try again.",
  invalid_payment_method: "Please choose a payment method that's available for this order.",
  delivery_unavailable: "Delivery is currently unavailable. Please choose Dine In or Take Out.",
  delivery_below_minimum: "Delivery is only available for larger orders. Please add more items or choose Dine In or Take Out.",
  delivery_area_invalid: "We don't deliver to that area right now. Please choose another barangay.",
  item_price_mismatch: "Prices have changed. Please review your order and place it again.",
  total_changed: "Your order total has changed. Please review it before placing your order again.",
  idempotency_key_reused: "Please review your order and place it again.",
  server_error: "We couldn't place your order right now. Your cart is saved, so please try again in a moment.",
} as const;

export type OrderErrorCode = keyof typeof ORDER_ERROR_MESSAGES;

export type OrderError = { ok: false; code: OrderErrorCode; message: string };

export function orderError(code: OrderErrorCode, message?: string): OrderError {
  return { ok: false, code, message: message ?? ORDER_ERROR_MESSAGES[code] };
}

/** Database errors carry the code as the message; anything else is a server error. */
export function orderErrorFromDatabase(message: string | undefined): OrderError {
  const code = message?.trim();
  return code && code in ORDER_ERROR_MESSAGES ? orderError(code as OrderErrorCode) : orderError("server_error");
}
