// Checkout form state.
// - Contact + address details are remembered on this phone (localStorage) so a
//   returning customer doesn't retype them.
// - Order-specific choices (type, table, payment, notes) last only for this visit
//   (sessionStorage), so yesterday's table number never carries over.
import type { CheckoutForm } from "@/lib/checkout";
import { createLocalStore } from "@/lib/local-store";

type Contact = Pick<CheckoutForm, "name" | "phone" | "address" | "areaId" | "landmark">;
type Visit = Omit<CheckoutForm, keyof Contact>;

const EMPTY_CONTACT: Contact = { name: "", phone: "", address: "", areaId: null, landmark: "" };
const EMPTY_VISIT: Visit = {
  orderType: null,
  tableInput: "",
  deliveryInstructions: "",
  paymentMethod: null,
  orderNotes: "",
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

const contactStore = createLocalStore<Contact>({
  key: "rnfc:contact:v1",
  initial: EMPTY_CONTACT,
  maxAgeMs: 90 * 24 * 60 * 60 * 1000,
  parse: (stored) => {
    const s = stored as Partial<Contact> | null;
    if (!s || typeof s !== "object") return null;
    return {
      name: str(s.name),
      phone: str(s.phone),
      address: str(s.address),
      areaId: typeof s.areaId === "string" ? s.areaId : null,
      landmark: str(s.landmark),
    };
  },
});

const visitStore = createLocalStore<Visit>({
  key: "rnfc:checkout:v1",
  storage: "session",
  initial: EMPTY_VISIT,
  parse: (stored) => {
    const s = stored as Partial<Visit> | null;
    if (!s || typeof s !== "object") return null;
    return {
      orderType: s.orderType === "dine_in" || s.orderType === "take_out" || s.orderType === "delivery" ? s.orderType : null,
      tableInput: str(s.tableInput),
      deliveryInstructions: str(s.deliveryInstructions),
      paymentMethod: s.paymentMethod === "cash" || s.paymentMethod === "gcash" || s.paymentMethod === "counter" ? s.paymentMethod : null,
      orderNotes: str(s.orderNotes),
    };
  },
});

const CONTACT_KEYS = new Set<keyof CheckoutForm>(Object.keys(EMPTY_CONTACT) as Array<keyof Contact>);

export function useCheckoutForm(): CheckoutForm {
  const contact = contactStore.useValue();
  const visit = visitStore.useValue();
  return { ...contact, ...visit };
}

export function updateCheckoutForm(patch: Partial<CheckoutForm>) {
  const contactPatch: Partial<Contact> = {};
  const visitPatch: Partial<Visit> = {};
  for (const [key, value] of Object.entries(patch) as Array<[keyof CheckoutForm, never]>) {
    if (CONTACT_KEYS.has(key)) contactPatch[key as keyof Contact] = value;
    else visitPatch[key as keyof Visit] = value;
  }
  if (Object.keys(contactPatch).length) contactStore.set({ ...contactStore.get(), ...contactPatch });
  if (Object.keys(visitPatch).length) visitStore.set({ ...visitStore.get(), ...visitPatch });
}

/** After a successful order: forget this visit's choices; keep name/phone/address for next time. */
export function resetCheckoutVisit() {
  visitStore.set(EMPTY_VISIT);
}
