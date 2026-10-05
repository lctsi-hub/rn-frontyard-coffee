"use client";

import { Pencil, Trash2 } from "lucide-react";
import { ProductArt } from "@/components/menu/ProductArt";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatPeso } from "@/lib/format";
import { MAX_QUANTITY, optionLabel, type PricedItem } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { cartActions, type CartLine } from "@/stores/cart";

const actionButton =
  "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-[transform,background-color] duration-150 active:scale-95";

export function CartLineItem({
  line,
  priced,
  categorySlug,
  onEdit,
  onRemove,
}: {
  line: CartLine;
  priced: PricedItem | null;
  categorySlug: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  if (!priced) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-[1.75rem] bg-foam/60 p-4 ring-1 ring-espresso/5">
        <p className="text-sm text-mocha">This item is no longer on the menu.</p>
        <button type="button" onClick={onRemove} className={cn(actionButton, "text-berry ring-1 ring-berry/30")}>
          <Trash2 className="size-4" /> Remove
        </button>
      </li>
    );
  }

  const { product, size, options, addons, unitPrice, lineTotal, issues } = priced;
  const blocked = issues.length > 0;
  const details = [size?.name, ...options.map(optionLabel)].filter(Boolean).join(" · ");

  return (
    <li
      className={cn(
        "animate-fade-up rounded-[1.75rem] bg-foam p-3 shadow-card ring-1 ring-espresso/5",
        blocked && "ring-2 ring-berry/30",
      )}
    >
      <div className="flex gap-3">
        <ProductArt
          imageUrl={product.imageUrl}
          name={product.name}
          categorySlug={categorySlug}
          sizes="80px"
          soldOut={!product.isAvailable}
          className="size-20 shrink-0 rounded-2xl"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display min-w-0 text-[1.0625rem] leading-snug font-semibold break-words">
              {product.name}
            </h3>
            <p key={lineTotal} className="shrink-0 animate-pop font-semibold tabular-nums">
              {formatPeso(lineTotal)}
            </p>
          </div>

          {details && <p className="mt-0.5 text-sm text-coffee">{details}</p>}

          {addons.length > 0 && (
            <ul className="mt-1 text-sm text-mocha">
              {addons.map((addon) => (
                <li key={addon.id} className="flex justify-between gap-2">
                  <span className="min-w-0 break-words">+ {addon.name}</span>
                  <span className="shrink-0 tabular-nums">{formatPeso(addon.price)}</span>
                </li>
              ))}
            </ul>
          )}

          {line.quantity > 1 && (
            <p className="mt-1 text-xs text-mocha tabular-nums">{formatPeso(unitPrice)} each</p>
          )}
        </div>
      </div>

      {line.notes && (
        <p className="mt-3 rounded-2xl bg-oat/50 px-3.5 py-2.5 text-sm break-words text-coffee">
          <span className="font-semibold">Note: </span>
          {line.notes}
        </p>
      )}

      {blocked && (
        <p role="alert" className="mt-3 text-sm font-medium text-berry">
          {issues.join(". ")}.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {product.isAvailable && (
            <button type="button" onClick={onEdit} className={cn(actionButton, "text-coffee active:bg-oat")}>
              <Pencil className="size-4" /> Edit
            </button>
          )}
          <button type="button" onClick={onRemove} className={cn(actionButton, "text-berry active:bg-berry/10")}>
            <Trash2 className="size-4" /> Remove
          </button>
        </div>

        {!blocked && (
          <QuantityStepper
            size="sm"
            value={line.quantity}
            max={MAX_QUANTITY}
            onChange={(quantity) => cartActions.setQuantity(line.lineId, quantity)}
            label={`Quantity of ${product.name}`}
          />
        )}
      </div>
    </li>
  );
}
