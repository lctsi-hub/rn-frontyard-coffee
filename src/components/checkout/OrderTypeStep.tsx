"use client";

import { Bike, Check, ShoppingBag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import {
  amountUntilFreeDelivery,
  deliveryFeeSummary,
  isDeliveryAvailable,
  orderTypeBlockReason,
  qualifiesForFreeDelivery,
} from "@/lib/checkout";
import { formatPeso } from "@/lib/format";
import { STORE } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { OrderType, StoreSettings } from "@/types/order";

const OPTIONS: Array<{ type: OrderType; title: string; subtitle: string; icon: LucideIcon }> = [
  { type: "dine_in", title: "Dine In", subtitle: "Enjoy it here at the shop.", icon: UtensilsCrossed },
  { type: "take_out", title: "Take Out", subtitle: "Pick it up at the counter.", icon: ShoppingBag },
  {
    type: "delivery",
    title: "Delivery",
    subtitle: `We'll bring it to you around ${STORE.location.barangay}, ${STORE.location.municipality}.`,
    icon: Bike,
  },
];

/** Extra line under the Delivery card explaining fees or what's missing. */
function deliveryNote(settings: StoreSettings, subtotal: number, blocked: boolean) {
  if (!isDeliveryAvailable(settings)) return null;
  if (blocked) {
    const short = settings.delivery.minimumOrder - subtotal;
    return `Add ${formatPeso(short)} more to unlock delivery.`;
  }
  if (qualifiesForFreeDelivery(settings, subtotal)) return "FREE delivery on this order!";
  const untilFree = amountUntilFreeDelivery(settings, subtotal);
  return untilFree === null
    ? `${deliveryFeeSummary(settings)}.`
    : `${deliveryFeeSummary(settings)}. Add ${formatPeso(untilFree)} more for FREE delivery.`;
}

export function OrderTypeStep({
  value,
  settings,
  subtotal,
  tableFromLink,
  error,
  onChange,
}: {
  value: OrderType | null;
  settings: StoreSettings;
  subtotal: number;
  tableFromLink: number | null;
  error?: string;
  onChange: (type: OrderType) => void;
}) {
  return (
    <section aria-labelledby="order-type-title">
      <h1 id="order-type-title" className="font-display text-[1.75rem] leading-tight font-semibold">
        How would you like your order?
      </h1>

      <div
        id="field-orderType"
        role="radiogroup"
        aria-labelledby="order-type-title"
        className={cn("mt-5 flex flex-col gap-3", error && "animate-shake")}
      >
        {OPTIONS.map(({ type, title, subtitle, icon: Icon }, i) => {
          const blockReason = orderTypeBlockReason(settings, type, subtotal);
          const available = !blockReason;
          const selected = value === type;
          const note = type === "delivery" ? deliveryNote(settings, subtotal, !available) : null;
          return (
            <label
              key={type}
              style={{ animationDelay: `${i * 70}ms` }}
              className={cn(
                "relative flex min-h-24 animate-fade-up items-center gap-4 rounded-[1.75rem] p-4 ring-1 transition-[background-color,color,transform,box-shadow] duration-200 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-caramel",
                !available && "cursor-not-allowed bg-oat/40 ring-espresso/5",
                available && !selected && "cursor-pointer bg-foam shadow-card ring-espresso/5 active:scale-[0.98]",
                selected && "bg-espresso text-foam shadow-lift ring-espresso",
              )}
            >
              <input
                type="radio"
                name="orderType"
                value={type}
                checked={selected}
                disabled={!available}
                aria-describedby={note || blockReason ? `order-type-${type}-note` : undefined}
                onChange={() => onChange(type)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-14 shrink-0 place-items-center rounded-2xl transition-colors",
                  selected ? "bg-foam/15 text-honey" : "bg-oat text-coffee",
                  !available && "bg-oat/60 text-espresso/40",
                )}
              >
                <Icon className="size-7" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("font-display block text-xl font-semibold", !available && "text-espresso/50")}>
                  {title}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-sm",
                    selected ? "text-foam/75" : available ? "text-mocha" : "font-medium text-coffee",
                  )}
                >
                  {blockReason ?? subtitle}
                </span>
                {note && (
                  <span
                    id={`order-type-${type}-note`}
                    className={cn(
                      "mt-2 inline-block rounded-xl px-2.5 py-1 text-xs font-semibold",
                      selected ? "bg-foam/15 text-honey" : available ? "bg-oat text-caramel" : "bg-honey/40 text-espresso",
                    )}
                  >
                    {note}
                  </span>
                )}
                {type === "dine_in" && tableFromLink && (
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
                      selected ? "bg-foam text-espresso" : "bg-espresso text-foam",
                    )}
                  >
                    Table {tableFromLink}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full ring-2 transition-colors",
                  selected ? "bg-honey text-espresso ring-honey" : "ring-espresso/20",
                  !available && "opacity-0",
                )}
              >
                {selected && <Check className="size-4" strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-berry">
          {error}
        </p>
      )}
    </section>
  );
}
