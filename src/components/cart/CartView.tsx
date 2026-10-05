"use client";

import Link from "next/link";
import { ArrowRight, Plus, ShoppingBag, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMenuIndex } from "@/components/menu/MenuProvider";
import { useProductSheet } from "@/components/menu/ProductSheet";
import { useHydrated } from "@/hooks/useHydrated";
import { formatPeso } from "@/lib/format";
import { amountUntilFreeDelivery, deliveryBlockReason, isDeliveryAvailable } from "@/lib/checkout";
import { summarizeCart } from "@/lib/pricing";
import { withTable } from "@/lib/table";
import { cartActions, useCart, type CartLine } from "@/stores/cart";
import type { StoreSettings } from "@/types/order";
import { CartLineItem } from "./CartLineItem";

type Removed = { line: CartLine; index: number; name: string };

export function CartView({ table, settings }: { table: number | null; settings: StoreSettings }) {
  const hydrated = useHydrated();
  const cart = useCart();
  const index = useMenuIndex();
  const { editLine } = useProductSheet();
  const [removed, setRemoved] = useState<Removed | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 5000);
    return () => clearTimeout(timer);
  }, [removed]);

  if (!hydrated) return <CartSkeleton />;

  const { items, itemCount, subtotal, hasProblems } = summarizeCart(index, cart.lines);

  function remove(line: CartLine) {
    const position = cart.lines.findIndex((l) => l.lineId === line.lineId);
    cartActions.remove(line.lineId);
    setRemoved({ line, index: position, name: index.products.get(line.productId)?.name ?? "Item" });
  }

  const undo = removed && (
    <UndoToast
      name={removed.name}
      raised={cart.lines.length > 0}
      onUndo={() => {
        cartActions.restore(removed.line, removed.index);
        setRemoved(null);
      }}
    />
  );

  if (cart.lines.length === 0) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-6 pt-16 pb-safe text-center">
        <span className="grid size-24 animate-fade-up place-items-center rounded-full bg-oat text-coffee">
          <ShoppingBag className="size-10" strokeWidth={1.75} />
        </span>
        <h1 className="font-display mt-6 animate-fade-up text-2xl font-semibold [animation-delay:80ms]">
          Your cart is empty
        </h1>
        <p className="mt-2 animate-fade-up text-mocha [animation-delay:140ms]">
          Find something you&apos;ll love on the menu.
        </p>
        <Link
          href={withTable("/order", table)}
          className="mt-8 flex h-14 animate-fade-up items-center gap-2 rounded-full bg-espresso px-7 font-semibold text-foam shadow-lift transition-transform active:scale-[0.97] [animation-delay:200ms]"
        >
          Browse the menu <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>
        {undo}
      </main>
    );
  }

  const checkoutHref = withTable("/order/checkout", table);

  return (
    <>
      <main className="mx-auto max-w-md px-4 pt-2">
        <h1 className="sr-only">Your cart</h1>
        <ul className="flex flex-col gap-3">
          {items.map(({ line, priced }) => (
            <CartLineItem
              key={line.lineId}
              line={line}
              priced={priced}
              categorySlug={priced ? (index.categorySlugs.get(priced.product.categoryId) ?? "") : ""}
              onEdit={() => editLine(line)}
              onRemove={() => remove(line)}
            />
          ))}
        </ul>

        <Link
          href={withTable("/order", table)}
          className="mt-3 flex h-14 items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-latte font-semibold text-coffee transition-colors active:bg-oat/60"
        >
          <Plus className="size-4" strokeWidth={2.5} /> Add more items
        </Link>

        <section aria-label="Order summary" className="mt-6 rounded-[1.75rem] bg-oat/50 p-5">
          {table && (
            <p className="mb-3 text-sm text-coffee">
              Dine-in order for <span className="font-semibold">Table {table}</span>
            </p>
          )}
          <dl className="flex items-baseline justify-between">
            <dt className="text-mocha">
              Subtotal · {itemCount} {itemCount === 1 ? "item" : "items"}
            </dt>
            <dd key={subtotal} className="font-display animate-pop text-2xl font-semibold tabular-nums">
              {formatPeso(subtotal)}
            </dd>
          </dl>
          <DeliveryNote settings={settings} subtotal={subtotal} />
        </section>

        {/* Room for the sticky checkout bar. */}
        <div aria-hidden="true" className={hasProblems ? "h-48" : "h-40"} />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-espresso/10 bg-cream/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto max-w-md">
          {hasProblems && (
            <p className="mb-2 text-center text-sm font-medium text-berry">
              Remove or edit the unavailable items to continue.
            </p>
          )}
          <p className="mb-2 flex items-baseline justify-between px-1 text-sm">
            <span className="text-mocha">
              Subtotal · {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="font-semibold tabular-nums">{formatPeso(subtotal)}</span>
          </p>
          {hasProblems || itemCount === 0 ? (
            <button
              type="button"
              disabled
              className="flex h-14 w-full items-center justify-center rounded-full bg-espresso/35 font-semibold text-foam"
            >
              Continue to Checkout
            </button>
          ) : (
            <Link
              href={checkoutHref}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-espresso px-6 font-semibold text-foam shadow-lift transition-transform duration-150 active:scale-[0.98]"
            >
              Continue to Checkout
              <ArrowRight className="size-5 shrink-0" strokeWidth={2.5} />
            </Link>
          )}
        </div>
      </div>

      {undo}
    </>
  );
}

function UndoToast({ name, raised, onUndo }: { name: string; raised: boolean; onUndo: () => void }) {
  return (
    <div
      role="status"
      className={
        "fixed inset-x-0 z-50 px-4 " +
        (raised
          ? "bottom-[calc(7.75rem+max(0.75rem,env(safe-area-inset-bottom)))]"
          : "bottom-[max(1rem,env(safe-area-inset-bottom))]")
      }
    >
      <div className="mx-auto flex max-w-md animate-fade-up items-center gap-3 rounded-2xl bg-espresso py-2 pr-2 pl-4 text-sm text-foam shadow-lift">
        <span className="min-w-0 flex-1 truncate">Removed {name}</span>
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-foam/10 px-3 font-semibold text-honey active:bg-foam/20"
        >
          <Undo2 className="size-4" /> Undo
        </button>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto flex max-w-md flex-col gap-3 px-4 pt-2">
      {[0, 1].map((i) => (
        <div key={i} className="flex animate-pulse gap-3 rounded-[1.75rem] bg-foam/70 p-3">
          <div className="size-20 rounded-2xl bg-oat" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-2/3 rounded-full bg-oat" />
            <div className="h-3 w-1/3 rounded-full bg-oat" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading your cart…</span>
    </main>
  );
}

/** Delivery minimum / free-delivery hint under the cart subtotal. */
function DeliveryNote({ settings, subtotal }: { settings: StoreSettings; subtotal: number }) {
  if (!isDeliveryAvailable(settings)) return null;
  const { minimumOrder, freeDeliveryFrom } = settings.delivery;
  const untilFree = amountUntilFreeDelivery(settings, subtotal);

  let nudge: string;
  if (deliveryBlockReason(settings, subtotal)) nudge = `Add ${formatPeso(minimumOrder - subtotal)} more to unlock delivery.`;
  else if (untilFree > 0) nudge = `Add ${formatPeso(untilFree)} more for FREE delivery.`;
  else nudge = "Your order qualifies for FREE delivery.";

  return (
    <div className="mt-3 border-t border-dashed border-espresso/15 pt-3 text-xs text-mocha">
      <p>
        Delivery: {formatPeso(minimumOrder)} minimum order · FREE for orders {formatPeso(freeDeliveryFrom)} and above.
      </p>
      <p className="mt-1 font-semibold text-caramel">{nudge}</p>
    </div>
  );
}
