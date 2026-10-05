"use client";

import { Bike, History, MapPin, Phone, Plus, ShoppingBag, StickyNote, TriangleAlert, UtensilsCrossed, X } from "lucide-react";
import { formatPeso } from "@/lib/format";
import { optionNames, PAYMENT_LABELS, type AdminOrder, type OrderAdjustment } from "@/lib/orders/admin";
import { canAddItems, type PricedExtra } from "@/lib/orders/staff-items";
import { canCancel, nextAction, ORDER_TYPE_NAMES, statusLabel, type OrderStatus } from "@/lib/orders/status";
import { elapsed, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const TYPE_ICONS = { dine_in: UtensilsCrossed, take_out: ShoppingBag, delivery: Bike } as const;

/** Items staff added after checkout, keyed by order item id. */
export function addedItems(adjustments: OrderAdjustment[] | undefined) {
  return new Map((adjustments ?? []).map((a) => [a.order_item_id, a]));
}

export function OrderItemsList({
  order,
  large = false,
  added,
}: {
  order: Pick<AdminOrder, "order_items">;
  large?: boolean;
  /** Staff-added items (see addedItems); ones the kitchen hasn't acknowledged are marked NEW. */
  added?: Map<string, OrderAdjustment>;
}) {
  return (
    <ul className={cn("flex flex-col", large ? "gap-3" : "gap-2")}>
      {order.order_items.map((item) => {
        const details = [item.size_name, ...optionNames(item.options)].filter(Boolean).join(" · ");
        const addons = optionNames(item.addons);
        const addition = added?.get(item.id);
        const isNew = Boolean(addition && !addition.acknowledged_at);
        return (
          <li
            key={item.id}
            className={cn(
              "flex gap-2.5",
              isNew && (large ? "-mx-2 rounded-2xl bg-honey/60 p-2 ring-2 ring-honey" : "-mx-1.5 rounded-xl bg-honey/40 p-1.5"),
            )}
          >
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-lg bg-espresso font-bold text-foam tabular-nums",
                large ? "h-9 min-w-9 px-1.5 text-lg" : "h-6 min-w-6 px-1 text-xs",
              )}
            >
              {item.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              {addition && (
                <span
                  className={cn(
                    "mb-0.5 inline-block rounded-md px-1.5 py-0.5 font-bold tracking-wide uppercase",
                    large ? "text-sm" : "text-[0.65rem]",
                    isNew ? "bg-berry text-foam" : "bg-oat text-coffee",
                  )}
                >
                  {isNew ? "New · Added" : "Added"}
                </span>
              )}
              <p className={cn("font-semibold break-words", large && "text-lg leading-snug")}>{item.product_name}</p>
              {details && <p className={cn("text-coffee", large ? "text-base" : "text-sm")}>{details}</p>}
              {addons.map((a) => (
                <p key={a} className={cn("font-medium text-caramel", large ? "text-base" : "text-sm")}>
                  + {a}
                </p>
              ))}
              {item.notes && (
                <p className={cn("mt-0.5 rounded-lg bg-honey/30 px-2 py-1 break-words text-espresso", large ? "text-base" : "text-sm")}>
                  “{item.notes}”
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminOrderCard({
  order,
  now,
  highlight,
  pending,
  onAdvance,
  onCancel,
  adjustments,
  quickExtras = [],
  onAddItem,
  onQuickAdd,
  id,
}: {
  order: AdminOrder;
  now: number;
  highlight: boolean;
  pending: boolean;
  onAdvance: (to: OrderStatus) => void;
  onCancel: () => void;
  /** Items staff added after checkout (audit trail). */
  adjustments?: OrderAdjustment[];
  /** Extras with a one-tap button on dine-in orders (+ Rice, + Kimchi). */
  quickExtras?: PricedExtra[];
  onAddItem?: () => void;
  onQuickAdd?: (extra: PricedExtra) => void;
  id?: string;
}) {
  const type = order.order_type;
  const status = order.status as OrderStatus;
  const action = nextAction(type, status);
  const TypeIcon = TYPE_ICONS[type];
  const addable = canAddItems(status) && Boolean(onAddItem);
  const quickButtons = type === "dine_in" && addable ? quickExtras.filter((e) => e.quickButton && e.isAvailable) : [];

  return (
    <article
      id={id}
      className={cn(
        "scroll-mt-24 rounded-3xl bg-white p-4 shadow-card ring-1 ring-espresso/10 transition-shadow",
        highlight && "animate-bump ring-4 ring-honey",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none font-bold">{order.order_number}</p>
          {type === "dine_in" && order.table_number ? (
            <p className="mt-1.5 inline-block rounded-lg bg-espresso px-2.5 py-1 text-lg leading-none font-extrabold tracking-wide text-foam">
              TABLE {order.table_number}
            </p>
          ) : null}
          <p className="mt-1.5 text-sm font-semibold text-espresso">Status: {statusLabel(type, status)}</p>
          <p className="mt-0.5 text-xs text-mocha">
            {formatTime(order.created_at)} · {elapsed(order.created_at, now)} ago
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            type === "delivery" ? "bg-caramel text-foam" : type === "dine_in" ? "bg-espresso text-foam" : "bg-oat text-espresso",
          )}
        >
          <TypeIcon className="size-4" />
          {ORDER_TYPE_NAMES[type]}
        </span>
      </header>

      <div className="mt-3 text-sm">
        <p className="font-semibold break-words">{order.customer_name}</p>
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-coffee underline-offset-2 hover:underline">
            <Phone className="size-3.5" /> {order.customer_phone}
          </a>
        )}
        {type === "delivery" && (
          <div className="mt-2 rounded-2xl bg-cream p-3 text-coffee">
            <p className="flex items-start gap-1.5 font-semibold text-espresso">
              <MapPin className="mt-0.5 size-4 shrink-0 text-caramel" /> Brgy. {order.delivery_area_name}
            </p>
            <p className="mt-1 break-words">{order.delivery_address}</p>
            <p className="break-words">
              <span className="text-mocha">Landmark:</span> {order.delivery_landmark}
            </p>
            {order.delivery_instructions && (
              <p className="break-words">
                <span className="text-mocha">Instructions:</span> {order.delivery_instructions}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-dashed border-espresso/15 pt-3">
        <OrderItemsList order={order} added={addedItems(adjustments)} />
        {adjustments && adjustments.length > 0 && <AddedAfterCheckout order={order} adjustments={adjustments} />}
        {order.notes && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-honey/30 px-3 py-2 text-sm break-words">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-caramel" /> {order.notes}
          </p>
        )}
      </div>

      <dl className="mt-3 space-y-0.5 border-t border-dashed border-espresso/15 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-mocha">Payment</dt>
          <dd className="font-semibold">{PAYMENT_LABELS[order.payment_method]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-mocha">Subtotal</dt>
          <dd className="tabular-nums">{formatPeso(Number(order.subtotal))}</dd>
        </div>
        {type === "delivery" && (
          <div className="flex justify-between">
            <dt className="text-mocha">Delivery fee</dt>
            <dd className="tabular-nums">{Number(order.delivery_fee) === 0 ? "FREE" : formatPeso(Number(order.delivery_fee))}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-xl font-bold tabular-nums">{formatPeso(Number(order.total))}</dd>
        </div>
      </dl>

      {addable && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quickButtons.map((extra) => (
            <button
              key={extra.id}
              type="button"
              onClick={() => onQuickAdd?.(extra)}
              className="inline-flex h-11 items-center gap-1 rounded-full bg-oat px-4 text-sm font-semibold text-espresso transition-colors active:bg-latte/60"
            >
              <Plus className="size-4" /> {extra.quickButton}
            </button>
          ))}
          <button
            type="button"
            onClick={onAddItem}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-full px-4 text-sm font-semibold whitespace-nowrap text-espresso ring-1 ring-espresso/20 transition-colors active:bg-oat"
          >
            <Plus className="size-4" /> Add Item
          </button>
        </div>
      )}

      <footer className="mt-3 flex gap-2">
        {action && (
          <button
            type="button"
            disabled={pending}
            onClick={() => onAdvance(action.to)}
            className="flex h-12 flex-1 items-center justify-center rounded-full bg-espresso px-4 font-semibold text-foam shadow-card transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Updating…" : action.label}
          </button>
        )}
        {canCancel(status) && (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            aria-label={`Cancel order ${order.order_number}`}
            className="flex h-12 items-center justify-center gap-1 rounded-full px-4 text-sm font-semibold text-berry ring-1 ring-berry/30 transition-colors active:bg-berry/10 disabled:opacity-50"
          >
            <X className="size-4" /> Cancel
          </button>
        )}
      </footer>
    </article>
  );
}

/** Staff-only: what was added after checkout, by whom, and the new total to collect. */
export function AddedAfterCheckout({
  order,
  adjustments,
}: {
  order: Pick<AdminOrder, "total" | "payment_method">;
  adjustments: OrderAdjustment[];
}) {
  const added = adjustments.reduce((sum, a) => sum + Number(a.amount), 0);
  const originalTotal = Number(adjustments[0].previous_total);
  return (
    <div className="mt-3 rounded-2xl bg-cream p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-espresso">
        <History className="size-4 text-caramel" /> Added after checkout
      </p>
      <ul className="mt-1.5 space-y-1 text-coffee">
        {adjustments.map((a) => (
          <li key={a.id} className="flex justify-between gap-3">
            <span className="min-w-0 break-words">
              {a.description} added by {a.added_by_name} · {formatTime(a.created_at)}
            </span>
            <span className="shrink-0 tabular-nums">+{formatPeso(Number(a.amount))}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 space-y-0.5 border-t border-espresso/10 pt-2">
        <div className="flex justify-between">
          <dt className="text-mocha">Original total</dt>
          <dd className="tabular-nums">{formatPeso(originalTotal)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Added amount</dt>
          <dd className="tabular-nums">{formatPeso(added)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>New total</dt>
          <dd className="tabular-nums">{formatPeso(Number(order.total))}</dd>
        </div>
      </dl>
      {order.payment_method === "gcash" && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-honey/40 px-2.5 py-1.5 font-medium text-espresso">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> Additional payment may need to be collected.
        </p>
      )}
    </div>
  );
}
