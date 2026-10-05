"use client";

import Link from "next/link";
import { ArrowRight, Check, ShoppingBag } from "lucide-react";
import { useMenuIndex } from "@/components/menu/MenuProvider";
import { formatPeso } from "@/lib/format";
import { summarizeCart } from "@/lib/pricing";
import { withTable } from "@/lib/table";
import { useCart } from "@/stores/cart";

/**
 * Sticky "View cart" bar shown on the menu once the cart has something in it.
 * Renders an in-flow spacer of the same height so it never covers the last items.
 */
export function FloatingCartBar({ table }: { table: number | null }) {
  const cart = useCart();
  const index = useMenuIndex();
  const { itemCount, subtotal } = summarizeCart(index, cart.lines);

  if (cart.lines.length === 0) return null;

  return (
    <>
      <div aria-hidden="true" className="h-24" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md animate-slide-up">
          <div key={cart.lastAddedAt ?? "initial"} className={cart.lastAddedAt ? "animate-bump" : undefined}>
            <Link
              href={withTable("/order/cart", table)}
              className="pointer-events-auto relative flex h-16 items-center gap-3 overflow-hidden rounded-full bg-espresso pr-2 pl-2 text-foam shadow-lift transition-transform duration-150 active:scale-[0.98]"
            >
              <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-foam/10">
                <ShoppingBag className="size-5" strokeWidth={2.25} />
                <span
                  key={itemCount}
                  className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 animate-pop place-items-center rounded-full bg-honey px-1 text-[0.6875rem] font-bold text-espresso tabular-nums"
                >
                  {itemCount}
                </span>
              </span>

              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-xs text-foam/70">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
                <span className="block font-semibold tabular-nums">{formatPeso(subtotal)}</span>
              </span>

              <span className="flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-foam px-4 text-sm font-semibold text-espresso">
                View cart
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </span>

              {cart.lastAddedAt && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex animate-added-flash items-center justify-center gap-2 rounded-full bg-espresso font-semibold"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-honey text-espresso">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                  Added to cart
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {cart.lastAddedAt ? `Added to cart. ${itemCount} items, ${formatPeso(subtotal)}.` : ""}
      </p>
    </>
  );
}
