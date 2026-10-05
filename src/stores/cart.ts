// Local cart, kept in localStorage so a refresh doesn't lose the order.
import { createLocalStore } from "@/lib/local-store";
import { MAX_NOTES_LENGTH, MAX_QUANTITY, type ItemSelection } from "@/lib/pricing";

export type CartLine = ItemSelection & { lineId: string };

type CartState = {
  lines: CartLine[];
  /** Set when an item is added, so the floating cart can animate. Not restored on reload. */
  lastAddedAt: number | null;
};

const EMPTY: CartState = { lines: [], lastAddedAt: null };

function isCartLine(value: unknown): value is CartLine {
  const line = value as CartLine;
  return (
    typeof line === "object" &&
    line !== null &&
    typeof line.lineId === "string" &&
    typeof line.productId === "string" &&
    (line.sizeId === null || typeof line.sizeId === "string") &&
    Array.isArray(line.optionIds) &&
    Array.isArray(line.addonIds) &&
    Number.isInteger(line.quantity) &&
    typeof line.notes === "string"
  );
}

const store = createLocalStore<CartState>({
  key: "rnfc:cart:v2",
  initial: EMPTY,
  // Carts untouched for 12 hours are treated as abandoned.
  maxAgeMs: 12 * 60 * 60 * 1000,
  parse: (stored) => {
    const lines = (stored as Partial<CartState> | null)?.lines;
    return Array.isArray(lines) ? { lines: lines.filter(isCartLine), lastAddedAt: null } : null;
  },
});

export const useCart = store.useValue;

// ---- actions -------------------------------------------------------------------

function clampQuantity(quantity: number) {
  return Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantity)));
}

function clean(selection: ItemSelection): ItemSelection {
  return {
    productId: selection.productId,
    sizeId: selection.sizeId,
    optionIds: [...selection.optionIds].sort(),
    addonIds: [...selection.addonIds].sort(),
    quantity: clampQuantity(selection.quantity),
    notes: selection.notes.trim().slice(0, MAX_NOTES_LENGTH),
  };
}

/** Two lines with the same product, choices and notes are merged into one. */
function sameItem(a: ItemSelection, b: ItemSelection) {
  return (
    a.productId === b.productId &&
    a.sizeId === b.sizeId &&
    a.notes === b.notes &&
    a.optionIds.join() === b.optionIds.join() &&
    a.addonIds.join() === b.addonIds.join()
  );
}

function newLineId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function setLines(lines: CartLine[], lastAddedAt = store.get().lastAddedAt) {
  store.set({ lines, lastAddedAt });
}

export const cartActions = {
  add(selection: ItemSelection) {
    const { lines } = store.get();
    const item = clean(selection);
    const existing = lines.find((line) => sameItem(line, item));
    setLines(
      existing
        ? lines.map((line) => (line === existing ? { ...line, quantity: clampQuantity(line.quantity + item.quantity) } : line))
        : [...lines, { ...item, lineId: newLineId() }],
      Date.now(),
    );
  },

  /** Replace a line after editing; merges into an identical line if one exists. */
  update(lineId: string, selection: ItemSelection) {
    const { lines } = store.get();
    const item = clean(selection);
    const duplicate = lines.find((line) => line.lineId !== lineId && sameItem(line, item));
    setLines(
      duplicate
        ? lines
            .filter((line) => line.lineId !== lineId)
            .map((line) =>
              line === duplicate ? { ...line, quantity: clampQuantity(line.quantity + item.quantity) } : line,
            )
        : lines.map((line) => (line.lineId === lineId ? { ...item, lineId } : line)),
    );
  },

  setQuantity(lineId: string, quantity: number) {
    setLines(
      store.get().lines.map((line) => (line.lineId === lineId ? { ...line, quantity: clampQuantity(quantity) } : line)),
    );
  },

  remove(lineId: string) {
    setLines(store.get().lines.filter((line) => line.lineId !== lineId));
  },

  /** Put a removed line back where it was (for "Undo"). */
  restore(line: CartLine, index: number) {
    const lines = [...store.get().lines];
    lines.splice(Math.min(index, lines.length), 0, line);
    setLines(lines);
  },

  clear() {
    setLines([]);
  },
};
