"use client";

// "+ Add Item" for an existing open order (e.g. one more rice for Table 5).
// Staff pick an item and choices here; the price shown is only a preview. The
// server rebuilds the item from the menu and the database adds it to the SAME
// order (same RN number, same table) with its own price snapshot.
import { ArrowLeft, Check, Plus, Search, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addOrderItemAction } from "@/app/admin/order-actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatPeso } from "@/lib/format";
import type { AddItemResult } from "@/lib/orders/add-order-item";
import type { AdminOrder } from "@/lib/orders/admin";
import type { PricedExtra } from "@/lib/orders/staff-items";
import { buildMenuIndex, MAX_NOTES_LENGTH, MAX_QUANTITY, priceItem } from "@/lib/pricing";
import { newRequestId } from "@/lib/request-id";
import { cn } from "@/lib/utils";
import type { Menu, Product } from "@/types/menu";

export type AddTarget = Pick<AdminOrder, "id" | "order_number" | "table_number" | "order_type" | "payment_method" | "total">;

type ItemChoice =
  | { kind: "extra"; extraId: string; quantity: number; notes: string }
  | { kind: "product"; productId: string; sizeId: string | null; optionIds: string[]; addonIds: string[]; quantity: number; notes: string };

type Added = Extract<AddItemResult, { ok: true }> & { paymentMethod: AdminOrder["payment_method"] };

export function orderLabel(order: Pick<AdminOrder, "order_number" | "table_number" | "order_type">) {
  return order.order_type === "dine_in" && order.table_number ? `Table ${order.table_number} / ${order.order_number}` : order.order_number;
}

// ---- controller: sheet + quick-add confirmation + result message -------------------------

export function useOrderAdditions({ menu, extras, onChanged }: { menu: Menu; extras: PricedExtra[]; onChanged?: () => void }) {
  const [sheetFor, setSheetFor] = useState<AddTarget | null>(null);
  const [quick, setQuick] = useState<{ order: AddTarget; extra: PricedExtra; requestId: string } | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [result, setResult] = useState<Added | null>(null);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [result]);

  /** Send one add request. A second call while one is running is ignored (double tap). */
  const submit = useCallback(
    async (order: AddTarget, requestId: string, item: ItemChoice): Promise<AddItemResult | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        const res = await addOrderItemAction({ orderId: order.id, requestId, item });
        if (res.ok) {
          setResult({ ...res, paymentMethod: order.payment_method });
          onChanged?.();
        }
        return res;
      } catch {
        return { ok: false, code: "server_error", message: "Couldn't reach the server. Check the connection and try again." };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [onChanged],
  );

  const element = (
    <>
      <AddItemSheet target={sheetFor} menu={menu} extras={extras} busy={busy} submit={submit} onClose={() => setSheetFor(null)} />
      <ConfirmDialog
        open={quick !== null}
        title={quick ? `Add ${quick.extra.name} ×1?` : "Add item?"}
        confirmLabel={quick ? `Add ${quick.extra.name} · ${formatPeso(quick.extra.price)}` : "Add"}
        cancelLabel="Cancel"
        busy={busy}
        busyLabel="Adding…"
        onConfirm={async () => {
          if (!quick) return;
          const res = await submit(quick.order, quick.requestId, { kind: "extra", extraId: quick.extra.id, quantity: 1, notes: "" });
          if (!res) return;
          if (res.ok) {
            setQuick(null);
            setQuickError(null);
          } else {
            setQuickError(res.message);
          }
        }}
        onCancel={() => {
          setQuick(null);
          setQuickError(null);
        }}
      >
        {quick && (
          <>
            <p>
              to <span className="font-semibold text-espresso">{orderLabel(quick.order)}</span>
            </p>
            {quickError && <p className="mt-2 rounded-xl bg-berry/10 px-3 py-2 text-sm text-berry">{quickError}</p>}
          </>
        )}
      </ConfirmDialog>
      {result && <AddedToast result={result} onDismiss={() => setResult(null)} />}
    </>
  );

  return {
    openAddItem: (order: AddTarget) => setSheetFor(order),
    quickAdd: (order: AddTarget, extra: PricedExtra) => {
      setQuickError(null);
      setQuick({ order, extra, requestId: newRequestId() });
    },
    element,
  };
}

function AddedSummary({ result }: { result: Added }) {
  const toCollect = result.newTotal - result.previousTotal;
  return (
    <>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
        <dt className="opacity-75">Added amount</dt>
        <dd className="text-right font-semibold tabular-nums">{formatPeso(result.addedAmount)}</dd>
        <dt className="opacity-75">New total</dt>
        <dd className="text-right font-semibold tabular-nums">{formatPeso(result.newTotal)}</dd>
        {toCollect !== result.addedAmount && (
          <>
            <dt className="opacity-75">Difference to collect</dt>
            <dd className="text-right font-semibold tabular-nums">{formatPeso(toCollect)}</dd>
          </>
        )}
      </dl>
      {result.paymentMethod === "gcash" && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> GCash order: additional payment may need to be collected.
        </p>
      )}
    </>
  );
}

function AddedToast({ result, onDismiss }: { result: Added; onDismiss: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div role="status" className="pointer-events-auto w-full max-w-md animate-fade-up rounded-2xl bg-espresso p-4 text-foam shadow-lift">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600">
            <Check className="size-5" />
          </span>
          <p className="min-w-0 flex-1 font-semibold">
            {result.isNew ? "Added" : "Already added"} {result.description} to{" "}
            {result.tableNumber ? `Table ${result.tableNumber} / ${result.orderNumber}` : result.orderNumber}
          </p>
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-foam/10">
            <X className="size-4" />
          </button>
        </div>
        <div className="pl-11">
          <AddedSummary result={result} />
        </div>
      </div>
    </div>
  );
}

// ---- the sheet --------------------------------------------------------------------------------

type Selected = { kind: "extra"; extra: PricedExtra } | { kind: "product"; product: Product };

function AddItemSheet({
  target,
  menu,
  extras,
  busy,
  submit,
  onClose,
}: {
  target: AddTarget | null;
  menu: Menu;
  extras: PricedExtra[];
  busy: boolean;
  submit: (order: AddTarget, requestId: string, item: ItemChoice) => Promise<AddItemResult | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const index = useMemo(() => buildMenuIndex(menu), [menu]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Added | null>(null);
  const requestId = useRef(newRequestId());

  const reset = useCallback(() => {
    setSearch("");
    setCategory("all");
    setSelected(null);
    setError(null);
    setDone(null);
    requestId.current = newRequestId();
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  const choose = (next: Selected) => {
    setSelected(next);
    setQuantity(1);
    setNotes("");
    setError(null);
    requestId.current = newRequestId(); // new item = new request
    if (next.kind === "product") {
      const p = next.product;
      setSizeId(p.sizes.length === 1 ? p.sizes[0].id : null);
      setOptionIds(p.variantGroups.flatMap((g) => (g.defaultOptionId ? [g.defaultOptionId] : [])));
      setAddonIds([]);
    }
  };

  const close = () => {
    if (busy) return;
    onClose();
    reset();
  };

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.products
      .filter((p) => (category === "all" || p.categoryId === category) && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menu.products, category, search]);

  const preview =
    selected?.kind === "product"
      ? priceItem(index, { productId: selected.product.id, sizeId, optionIds, addonIds, quantity, notes })
      : null;
  const lineTotal = selected?.kind === "extra" ? selected.extra.price * quantity : (preview?.lineTotal ?? 0);
  const missing = selected?.kind === "product" && (preview === null || preview.issues.length > 0);

  const send = async () => {
    if (!target || !selected || missing) return;
    const item: ItemChoice =
      selected.kind === "extra"
        ? { kind: "extra", extraId: selected.extra.id, quantity, notes }
        : { kind: "product", productId: selected.product.id, sizeId, optionIds, addonIds, quantity, notes };
    const res = await submit(target, requestId.current, item);
    if (!res) return;
    if (res.ok) {
      setDone({ ...res, paymentMethod: target.payment_method });
      setError(null);
    } else {
      setError(res.message);
    }
  };

  const title = target
    ? `Order #${target.order_number}${target.order_type === "dine_in" && target.table_number ? ` · Table ${target.table_number}` : ""}`
    : "";

  return (
    <dialog
      ref={ref}
      aria-labelledby="add-item-title"
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="sheet-panel flex flex-col overflow-hidden rounded-t-[1.75rem] bg-cream shadow-lift">
        <header className="flex items-center gap-2 border-b border-espresso/10 px-4 py-3">
          {selected && !done && (
            <button type="button" onClick={() => setSelected(null)} aria-label="Back to items" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-oat">
              <ArrowLeft className="size-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-mocha uppercase">Add Item</p>
            <h2 id="add-item-title" className="font-display text-xl leading-tight font-bold break-words">
              {title}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-oat">
            <X className="size-5" />
          </button>
        </header>

        {done ? (
          <div className="flex flex-col gap-4 p-5">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-espresso/10">
              <p className="flex items-center gap-2 font-semibold">
                <Check className="size-5 text-emerald-700" /> {done.isNew ? "Added" : "Already added"} {done.description}
              </p>
              <p className="mt-0.5 text-sm text-mocha">
                to {done.tableNumber ? `Table ${done.tableNumber} / ${done.orderNumber}` : done.orderNumber}
              </p>
              <AddedSummary result={done} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full font-semibold text-coffee ring-1 ring-espresso/15"
              >
                <Plus className="size-4" /> Add another
              </button>
              <button type="button" onClick={close} className="h-12 flex-1 rounded-full bg-espresso font-semibold text-foam">
                Done
              </button>
            </div>
          </div>
        ) : selected ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <p className="font-display text-2xl font-semibold">{selected.kind === "extra" ? selected.extra.name : selected.product.name}</p>
              {selected.kind === "product" && (
                <ProductChoices
                  product={selected.product}
                  menu={menu}
                  sizeId={sizeId}
                  optionIds={optionIds}
                  addonIds={addonIds}
                  onSize={setSizeId}
                  onOptions={setOptionIds}
                  onAddons={setAddonIds}
                />
              )}
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="font-semibold">Quantity</span>
                <QuantityStepper value={quantity} max={MAX_QUANTITY} onChange={setQuantity} label="Quantity" />
              </div>
              <label className="mt-5 block text-sm font-semibold">
                Special instruction <span className="font-normal text-mocha">(optional)</span>
                <input
                  value={notes}
                  maxLength={MAX_NOTES_LENGTH}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. less ice, no onions"
                  className="mt-1.5 h-12 w-full rounded-2xl bg-white px-4 text-base font-normal ring-1 ring-espresso/10"
                />
              </label>
              {error && <p className="mt-4 rounded-2xl bg-berry/10 px-4 py-3 text-sm text-berry">{error}</p>}
            </div>
            <footer className="border-t border-espresso/10 bg-cream px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={busy || missing}
                onClick={() => void send()}
                className="flex h-14 w-full items-center justify-center rounded-full bg-espresso font-semibold text-foam shadow-lift transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? "Adding…" : missing ? "Choose the options above" : `Add to ${target?.order_number ?? "order"} · ${formatPeso(lineTotal)}`}
              </button>
              <p className="mt-1.5 text-center text-xs text-mocha">Price is set by the menu when the item is added.</p>
            </footer>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {extras.length > 0 && (
              <section aria-label="Quick extras">
                <h3 className="text-xs font-semibold tracking-wide text-mocha uppercase">Quick extras</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {extras.map((extra) => (
                    <button
                      key={extra.id}
                      type="button"
                      disabled={!extra.isAvailable}
                      onClick={() => choose({ kind: "extra", extra })}
                      className="flex min-h-14 flex-col items-start justify-center rounded-2xl bg-white px-3 py-2 text-left ring-1 ring-espresso/10 transition-colors hover:bg-oat/50 disabled:opacity-45"
                    >
                      <span className="font-semibold">{extra.name}</span>
                      <span className="text-sm text-coffee tabular-nums">{extra.isAvailable ? formatPeso(extra.price) : "Sold out"}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section aria-label="Menu items" className="mt-5">
              <h3 className="text-xs font-semibold tracking-wide text-mocha uppercase">Menu</h3>
              <label className="relative mt-2 block">
                <span className="sr-only">Search menu</span>
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mocha" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search drinks and food"
                  className="h-12 w-full rounded-2xl bg-white pr-4 pl-10 text-base ring-1 ring-espresso/10"
                />
              </label>
              <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                {[{ id: "all", name: "All" }, ...menu.categories].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={category === c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold",
                      category === c.id ? "bg-espresso text-foam" : "bg-white text-coffee ring-1 ring-espresso/10",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {products.length === 0 && <li className="py-6 text-center text-sm text-mocha">No items match.</li>}
                {products.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={!p.isAvailable}
                      onClick={() => choose({ kind: "product", product: p })}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-espresso/5 transition-colors hover:bg-oat/50 disabled:opacity-45"
                    >
                      <span className="min-w-0 font-medium break-words">{p.name}</span>
                      <span className="shrink-0 text-sm text-coffee tabular-nums">
                        {!p.isAvailable
                          ? "Sold out"
                          : p.sizes.length > 0
                            ? `from ${formatPeso(Math.min(...p.sizes.map((s) => s.price)))}`
                            : formatPeso(p.basePrice)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </dialog>
  );
}

function ProductChoices({
  product,
  menu,
  sizeId,
  optionIds,
  addonIds,
  onSize,
  onOptions,
  onAddons,
}: {
  product: Product;
  menu: Menu;
  sizeId: string | null;
  optionIds: string[];
  addonIds: string[];
  onSize: (id: string) => void;
  onOptions: (ids: string[]) => void;
  onAddons: (ids: string[]) => void;
}) {
  const addons = menu.addons.filter((a) => product.addonIds.includes(a.id));
  const chip = (active: boolean) =>
    cn(
      "flex min-h-12 items-center justify-between gap-2 rounded-2xl px-4 py-2 text-left ring-1 transition-colors",
      active ? "bg-espresso text-foam ring-espresso" : "bg-white ring-espresso/10",
    );
  return (
    <div className="mt-3 flex flex-col gap-4">
      {product.sizes.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 font-semibold">Size</legend>
          <div className="grid grid-cols-2 gap-2">
            {product.sizes.map((s) => (
              <button key={s.id} type="button" aria-pressed={sizeId === s.id} onClick={() => onSize(s.id)} className={chip(sizeId === s.id)}>
                <span className="font-semibold">{s.name}</span>
                <span className="text-sm tabular-nums">{formatPeso(s.price)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {product.variantGroups.map((group) => (
        <fieldset key={group.id}>
          <legend className="mb-1.5 font-semibold">{group.name}</legend>
          <div className="grid grid-cols-2 gap-2">
            {group.options.map((o) => {
              const active = optionIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onOptions([...optionIds.filter((id) => !group.options.some((x) => x.id === id)), o.id])}
                  className={chip(active)}
                >
                  <span className="font-semibold">{o.name}</span>
                  {o.priceDelta !== 0 && <span className="text-sm tabular-nums">+{formatPeso(o.priceDelta)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {addons.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 font-semibold">
            Add-ons <span className="font-normal text-mocha">(optional)</span>
          </legend>
          <div className="flex flex-col gap-2">
            {addons.map((a) => {
              const active = addonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!a.isAvailable}
                  onClick={() => onAddons(active ? addonIds.filter((id) => id !== a.id) : [...addonIds, a.id])}
                  className={cn(chip(active), "disabled:opacity-45")}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="text-sm tabular-nums">{a.isAvailable ? `+${formatPeso(a.price)}` : "Sold out"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
