"use client";

import Link from "next/link";
import { ArrowLeft, Bell, BellOff, Check, Plus, StickyNote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createLocalStore } from "@/lib/local-store";
import type { AdminOrder } from "@/lib/orders/admin";
import { canAddItems, type PricedExtra } from "@/lib/orders/staff-items";
import { kitchenAction, ORDER_TYPE_NAMES, statusLabel, type OrderStatus } from "@/lib/orders/status";
import { elapsed, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Menu } from "@/types/menu";
import { useOrderAdditions } from "./AddItem";
import { addedItems, OrderItemsList } from "./AdminOrderCard";
import { playChime } from "./chime";
import { useLiveOrders } from "./useLiveOrders";

const soundStore = createLocalStore<boolean>({
  key: "rnfc:kitchen-sound:v1",
  initial: false,
  parse: (v) => (typeof v === "boolean" ? v : null),
});

/** Orders the kitchen/bar works on; "ready" stays visible until served/picked up/dispatched. */
const KITCHEN_STATUSES: OrderStatus[] = ["received", "confirmed", "preparing", "ready"];

export function KitchenBoard({ menu, extras }: { menu: Menu; extras: PricedExtra[] }) {
  const soundOn = soundStore.useValue();
  const [now, setNow] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [acking, setAcking] = useState<Set<string>>(new Set());

  const onNewOrders = useCallback((orders: AdminOrder[]) => {
    setFresh((prev) => new Set([...prev, ...orders.map((o) => o.id)]));
    if (soundStore.get()) void playChime();
  }, []);
  // Items added to an order after checkout: chime so the kitchen doesn't miss them.
  const onNewAdditions = useCallback(() => {
    if (soundStore.get()) void playChime();
  }, []);
  const live = useLiveOrders({ onNewOrders, onNewAdditions });
  const additions = useOrderAdditions({ menu, extras, onChanged: () => void live.reload() });

  const acknowledge = async (orderId: string) => {
    if (acking.has(orderId)) return;
    setAcking((prev) => new Set(prev).add(orderId));
    await live.acknowledgeAdditions(orderId);
    setAcking((prev) => new Set([...prev].filter((id) => id !== orderId)));
  };

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 15_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const orders = live.orders.filter((o) => KITCHEN_STATUSES.includes(o.status as OrderStatus));

  return (
    <div className="min-h-dvh bg-espresso px-4 py-4 text-foam sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="grid size-11 place-items-center rounded-full bg-foam/10 hover:bg-foam/20" aria-label="Back to dashboard">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="font-display text-3xl font-semibold">Kitchen &amp; Bar</h1>
          <span className="rounded-full bg-foam/10 px-3 py-1 text-sm tabular-nums">{orders.length} open</span>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !soundStore.get();
            soundStore.set(next);
            if (next) void playChime();
          }}
          aria-pressed={soundOn}
          className={cn("inline-flex h-11 items-center gap-2 rounded-full px-4 font-semibold", soundOn ? "bg-honey text-espresso" : "bg-foam/10")}
        >
          {soundOn ? <Bell className="size-5" /> : <BellOff className="size-5" />}
          {soundOn ? "Sound on" : "Sound off"}
        </button>
      </header>

      {(live.error || live.notice) && <p className="mt-4 rounded-2xl bg-berry px-4 py-3 font-medium">{live.error ?? live.notice}</p>}

      {live.loaded && orders.length === 0 && (
        <p className="mt-24 text-center text-2xl text-foam/60">No open orders. New orders appear here automatically.</p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {orders.map((order) => {
          const status = order.status as OrderStatus;
          const action = kitchenAction(status);
          const minutes = now ? Math.floor((now - new Date(order.created_at).getTime()) / 60000) : 0;
          const orderAdditions = live.adjustments.get(order.id);
          const unseen = (orderAdditions ?? []).filter((a) => !a.acknowledged_at);
          return (
            <article
              key={order.id}
              onClick={() => setFresh((prev) => (prev.has(order.id) ? new Set([...prev].filter((id) => id !== order.id)) : prev))}
              className={cn(
                "flex flex-col rounded-3xl bg-foam p-5 text-espresso shadow-lift",
                (fresh.has(order.id) || unseen.length > 0) && "ring-4 ring-honey",
                status === "ready" && unseen.length === 0 && "opacity-80",
              )}
            >
              {unseen.length > 0 && (
                <div className="-mx-5 -mt-5 mb-4 flex items-center gap-3 rounded-t-3xl bg-berry px-5 py-3 text-foam">
                  <p className="min-w-0 flex-1 text-lg leading-tight font-extrabold tracking-wide uppercase">
                    New items added
                    <span className="block text-sm font-semibold tracking-normal normal-case">
                      {unseen.map((a) => a.description).join(", ")}
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={acking.has(order.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      void acknowledge(order.id);
                    }}
                    className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-foam px-4 font-bold text-berry disabled:opacity-60"
                  >
                    <Check className="size-5" /> {acking.has(order.id) ? "…" : "Got it"}
                  </button>
                </div>
              )}
              <header className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-4xl leading-none font-bold">{order.order_number}</p>
                  {order.order_type === "dine_in" && order.table_number ? (
                    <p className="mt-2 inline-block rounded-lg bg-espresso px-2.5 py-1 text-2xl leading-none font-extrabold tracking-wide text-foam">
                      TABLE {order.table_number}
                    </p>
                  ) : (
                    <p className="mt-2 text-base font-semibold">{ORDER_TYPE_NAMES[order.order_type]}</p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "inline-block rounded-full px-3 py-1 text-lg font-bold tabular-nums",
                      minutes >= 20 ? "bg-berry text-foam" : minutes >= 10 ? "bg-honey" : "bg-oat",
                    )}
                  >
                    {now ? elapsed(order.created_at, now) : formatTime(order.created_at)}
                  </span>
                  <p className="mt-1 text-sm font-semibold text-mocha">{statusLabel(order.order_type, status)}</p>
                </div>
              </header>

              <div className="mt-4 flex-1 border-t-2 border-dashed border-espresso/15 pt-4">
                <OrderItemsList order={order} large added={addedItems(orderAdditions)} />
                {order.notes && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-honey/40 px-3 py-2 text-base font-medium break-words">
                    <StickyNote className="mt-1 size-5 shrink-0" /> {order.notes}
                  </p>
                )}
              </div>

              {action && (
                <button
                  type="button"
                  disabled={live.pending.has(order.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    void live.changeStatus(order, action.to);
                  }}
                  className={cn(
                    "mt-5 h-16 rounded-2xl text-xl font-bold shadow-card transition-transform active:scale-[0.98] disabled:opacity-50",
                    action.to === "ready" ? "bg-emerald-700 text-white" : "bg-espresso text-foam",
                  )}
                >
                  {live.pending.has(order.id) ? "Updating…" : action.label}
                </button>
              )}
              {canAddItems(status) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    additions.openAddItem(order);
                  }}
                  className="mt-2 inline-flex h-11 items-center justify-center gap-1 rounded-2xl text-base font-semibold text-coffee ring-1 ring-espresso/15"
                >
                  <Plus className="size-4" /> Add Item
                </button>
              )}
            </article>
          );
        })}
      </div>
      <div className="text-espresso">{additions.element}</div>
    </div>
  );
}
