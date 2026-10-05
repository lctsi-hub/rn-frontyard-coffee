// Pure checkout rules: phone numbers, delivery fees, payment availability and
// form validation. Shared by the checkout screens and (later) the server.
// The delivery amounts themselves live in src/data/store-settings.ts.
import { formatPeso } from "@/lib/format";
import { MAX_TABLE_NUMBER, parseTableParam } from "@/lib/table";
import type { DeliveryArea, OrderType, PaymentMethod, PaymentMethodId, StoreSettings } from "@/types/order";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: "Dine In",
  take_out: "Take Out",
  delivery: "Delivery",
};

export const MAX_FIELD_LENGTH = { name: 60, address: 160, landmark: 120, instructions: 200, orderNotes: 200 } as const;

/** Accepts 09171234567, 0917 123 4567, +63 917 123 4567, 639171234567. Returns 09171234567 or null. */
export function normalizePhMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("63")) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : null;
}

/** 09171234567 → 0917 123 4567 */
export function formatPhMobile(mobile: string) {
  return `${mobile.slice(0, 4)} ${mobile.slice(4, 7)} ${mobile.slice(7)}`;
}

export function activeDeliveryAreas(settings: StoreSettings): DeliveryArea[] {
  return settings.delivery.areas.filter((area) => area.isActive);
}

export function isDeliveryAvailable(settings: StoreSettings) {
  return settings.delivery.enabled && activeDeliveryAreas(settings).length > 0;
}

export function findDeliveryArea(settings: StoreSettings, areaId: string | null) {
  return activeDeliveryAreas(settings).find((a) => a.id === areaId) ?? null;
}

/** The normal fee for an area, before the free-delivery rule. */
export function areaDeliveryFee(_settings: StoreSettings, area: DeliveryArea) {
  return area.fee;
}

export function qualifiesForFreeDelivery(settings: StoreSettings, subtotal: number) {
  const from = settings.delivery.freeDeliveryFrom;
  return from !== null && subtotal >= from;
}

/** How much more the customer needs to add for free delivery (0 if already free, null if there's no free delivery). */
export function amountUntilFreeDelivery(settings: StoreSettings, subtotal: number) {
  const from = settings.delivery.freeDeliveryFrom;
  return from === null ? null : Math.max(0, from - subtotal);
}

export type DeliveryQuote = {
  area: DeliveryArea;
  /** The area's normal fee. */
  regularFee: number;
  /** What the customer pays: 0 when the free-delivery rule applies. */
  fee: number;
  isFree: boolean;
};

export function quoteDelivery(settings: StoreSettings, areaId: string | null, subtotal: number): DeliveryQuote | null {
  const area = findDeliveryArea(settings, areaId);
  if (!area) return null;
  const regularFee = areaDeliveryFee(settings, area);
  const isFree = qualifiesForFreeDelivery(settings, subtotal);
  return { area, regularFee, fee: isFree ? 0 : regularFee, isFree };
}

/** Why delivery can't be chosen for this order, or null if it can. */
export function deliveryBlockReason(settings: StoreSettings, subtotal: number): string | null {
  if (!isDeliveryAvailable(settings)) return "Delivery is currently unavailable. Please choose Dine In or Take Out.";
  if (subtotal < settings.delivery.minimumOrder) {
    return `Delivery is available for orders worth ${formatPeso(settings.delivery.minimumOrder)} and above.`;
  }
  return null;
}

/** "₱50–₱70 delivery fee depending on your barangay", built from the active areas. */
export function deliveryFeeSummary(settings: StoreSettings) {
  const fees = activeDeliveryAreas(settings).map((a) => a.fee);
  if (fees.length === 0) return "Delivery fee depends on your barangay";
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  return min === max
    ? `${formatPeso(min)} delivery fee`
    : `${formatPeso(min)}–${formatPeso(max)} delivery fee depending on your barangay`;
}

export function paymentMethodsFor(settings: StoreSettings, orderType: OrderType | null): PaymentMethod[] {
  if (!orderType) return [];
  return settings.paymentMethods.filter((m) => m.enabled && m.orderTypes.includes(orderType));
}

/** Why this order type can't be chosen right now, or null if it can. */
export function orderTypeBlockReason(settings: StoreSettings, orderType: OrderType, subtotal: number): string | null {
  return orderType === "delivery" ? deliveryBlockReason(settings, subtotal) : null;
}

/** Everything the customer fills in during checkout. */
export type CheckoutForm = {
  orderType: OrderType | null;
  /** Typed table number, used only when the QR link has no ?table=. */
  tableInput: string;
  name: string;
  phone: string;
  address: string;
  areaId: string | null;
  landmark: string;
  deliveryInstructions: string;
  paymentMethod: PaymentMethodId | null;
  orderNotes: string;
};

export type FieldErrors = Partial<Record<keyof CheckoutForm, string>>;

/** The table this order is for: from the QR link if present, otherwise what the customer typed. */
export function resolveTable(form: CheckoutForm, tableFromLink: number | null) {
  return tableFromLink ?? parseTableParam(form.tableInput);
}

export function validateDetails(
  form: CheckoutForm,
  settings: StoreSettings,
  tableFromLink: number | null,
  subtotal: number,
): FieldErrors {
  const errors: FieldErrors = {};
  const type = form.orderType;
  if (!type) return { orderType: "Please choose how you'd like your order." };
  const blocked = orderTypeBlockReason(settings, type, subtotal);
  if (blocked) return { orderType: blocked };

  if (!form.name.trim()) errors.name = "Please enter your name.";

  const phoneRequired = type !== "dine_in";
  if (form.phone.trim() && !normalizePhMobile(form.phone)) {
    errors.phone = "Enter a valid mobile number, e.g. 0917 123 4567.";
  } else if (phoneRequired && !form.phone.trim()) {
    errors.phone = "Please enter your mobile number.";
  }

  if (type === "dine_in" && !resolveTable(form, tableFromLink)) {
    errors.tableInput = `Enter your table number (1–${MAX_TABLE_NUMBER}).`;
  }

  if (type === "delivery") {
    if (!findDeliveryArea(settings, form.areaId)) errors.areaId = "Please choose your barangay.";
    if (!form.address.trim()) errors.address = "Please enter your complete address.";
    if (!form.landmark.trim()) errors.landmark = "Please add a landmark so our rider can find you.";
  }

  return errors;
}

export function validatePayment(form: CheckoutForm, settings: StoreSettings): FieldErrors {
  const methods = paymentMethodsFor(settings, form.orderType);
  return methods.some((m) => m.id === form.paymentMethod) ? {} : { paymentMethod: "Please choose how you'll pay." };
}
