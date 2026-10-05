"use client";

import { Bell, BellOff, Radio, RefreshCw, UtensilsCrossed, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatPeso } from "@/lib/format";
import { createLocalStore } from "@/lib/local-store";
import type { AdminOrder } from "@/lib/orders/admin";
import { canAddItems, type PricedExtra } from "@/lib/orders/staff-items";
import { ORDER_TYPE_NAMES, statusLabel, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";
import type { Menu } from "@/types/menu";
import { useOrderAdditions } from "./AddItem";
import { AdminOrderCard } from "./AdminOrderCard";
import { playChime } from "./chime";
import { useLiveOrders } from "./useLiveOrders";

const soundStore = createLocalStore<boolean>({
  key: "rnfc:admin-sound:v1",
  initial: false,
  parse: (v) => (typeof v === "boolean" ? v : null),
});

const COLUMNS: Array<{ status: OrderStatus; title: string }> = [
  { status: "received", title: "New" },
  { status: "confirmed", title: "Confirmed" },
  { status: "preparing", title: "Preparing" },
  { status: "ready", title: "Ready" },
  { status: "out_for_delivery", title: "Out for Delivery" },
];

const HIGHLIGHT_MS = 2 * 60 * 1000;

const cardId = (orderId: string) => `order-${orderId}`;

export function LiveDashboard({ menu, extras }: { menu: Menu; extras: PricedExtra[] }) {
  const soundOn = soundStore.useValue();
  const [alert, setAlert] = useState<{ numbers: string[]; summary: string } | null>(null);
  const [highlighted, setHighlighted] = useState<Map<string, number>>(new Map());
  const [now, setNow] = useState(0);
  const [cancelling, setCancelling] = useState<AdminOrder | null>(null);

  const onNewOrders = useCallback(
    (fresh: AdminOrder[]) => {
      const at = Date.now();
      setHighlighted((prev) => {
        const next = new Map(prev);
        fresh.forEach((o) => next.set(o.id, at));
        return next;
      });
      const first = fresh[0];
      setAlert({
        numbers: fresh.map((o) => o.order_number),
        summary:
          fresh.length === 1
            ? `${ORDER_TYPE_NAMES[first.order_type]}${first.order_type === "dine_in" && first.table_number ? ` · Table ${first.table_number}` : ""} · ${formatPeso(Number(first.total))}`
            : `${fresh.length} new orders`,
      });
      if (soundStore.get()) void playChime();
    },
    [],
  );

  const live = useLiveOrders({ onNewOrders });
  const additions = useOrderAdditions({ menu, extras, onChanged: () => void live.reload() });

  /** Active Tables: jump to that table's open order and flash it. */
  const showOrder = (order: AdminOrder) => {
    document.getElementById(cardId(order.id))?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setHighlighted((prev) => new Map(prev).set(order.id, Date.now()));
  };

  // Clock for "x min ago" and for fading highlights.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const isHighlighted = (id: string) => {
    const at = highlighted.get(id);
    return at !== undefined && now - at < HIGHLIGHT_MS;
  };

  const toggleSound = () => {
    const next = !soundStore.get();
    soundStore.set(next);
    if (next) void playChime(); // also unlocks audio in the browser
  };

  const active = live.orders;
  // Dine-in orders that can still take items, by table (only open orders: never an old completed one).
  const tables = active
    .filter((o) => o.order_type === "dine_in" && o.table_number && canAddItems(o.status))
    .sort((a, b) => (a.table_number ?? 0) - (b.table_number ?? 0) || a.created_at.localeCompare(b.created_at));
  const todayValid = live.today.filter((o) => o.status !== "cancelled");
  const count = (status: OrderStatus) => active.filter((o) => o.status === status).length;
  const stats = [
    { label: "New Orders", value: count("received"), accent: true },
    { label: "Preparing", value: count("confirmed") + count("preparing") },
    { label: "Ready", value: count("ready") },
    { label: "Delivery", value: count("out_for_delivery") },
    { label: "Completed Today", value: live.today.filter((o) => o.status === "completed").length },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Live orders</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-mocha">
            {live.connection === "live" ? (
              <>
                <Radio className="size-4 text-emerald-700" /> Live updates on
              </>
            ) : (
              <>
                <RefreshCw className="size-4" /> Auto-refreshing every 30 seconds
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 transition-colors",
            soundOn ? "bg-espresso text-foam ring-espresso" : "bg-white text-coffee ring-espresso/15",
          )}
        >
          {soundOn ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          {soundOn ? "Sound on" : "Sound off"}
        </button>
      </div>

      {alert && (
        <div role="alert" className="mt-4 flex animate-fade-up items-center gap-3 rounded-2xl bg-honey px-4 py-3 text-espresso shadow-lift">
          <Bell className="size-5 shrink-0 animate-bump" />
          <p className="min-w-0 flex-1">
            <span className="font-bold">New order {alert.numbers.join(", ")}</span>
            <span className="block text-sm sm:inline sm:before:content-['_·_']">{alert.summary}</span>
          </p>
          <button type="button" onClick={() => setAlert(null)} aria-label="Dismiss" className="grid size-9 place-items-center rounded-full hover:bg-espresso/10">
            <X className="size-4" />
          </button>
        </div>
      )}

      {(live.error || live.notice) && (
        <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl bg-berry/10 px-4 py-3 text-sm text-berry">
          <p className="min-w-0 flex-1">{live.error ?? live.notice}</p>
          {live.notice && (
            <button type="button" onClick={live.dismissNotice} aria-label="Dismiss" className="shrink-0">
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      <section aria-label="Today at a glance" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className={cn("rounded-2xl p-4 shadow-card ring-1 ring-espresso/5", s.accent && s.value > 0 ? "bg-espresso text-foam" : "bg-white")}>
            <p className={cn("text-xs font-semibold tracking-wide uppercase", s.accent && s.value > 0 ? "text-foam/70" : "text-mocha")}>{s.label}</p>
            <p className="font-display mt-1 text-3xl font-bold tabular-nums">{live.loaded ? s.value : "–"}</p>
          </div>
        ))}
      </section>

      <section aria-label="Today's totals" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Mini label="Orders today" value={String(todayValid.length)} loaded={live.loaded} />
        <Mini label="Sales today" value={formatPeso(todayValid.reduce((sum, o) => sum + Number(o.total), 0))} loaded={live.loaded} />
        <Mini label="Dine in" value={String(todayValid.filter((o) => o.order_type === "dine_in").length)} loaded={live.loaded} />
        <Mini label="Take out" value={String(todayValid.filter((o) => o.order_type === "take_out").length)} loaded={live.loaded} />
        <Mini label="Delivery" value={String(todayValid.filter((o) => o.order_type === "delivery").length)} loaded={live.loaded} />
      </section>
      <p className="mt-2 text-xs text-mocha">Sales and counts exclude cancelled orders. &ldquo;Today&rdquo; is Philippine time.</p>

      <section aria-label="Active tables" className="mt-5 rounded-3xl bg-white p-4 shadow-card ring-1 ring-espresso/5">
        <h2 className="flex items-center gap-2 font-semibold">
          <UtensilsCrossed className="size-4 text-caramel" /> Active Tables
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-oat px-2 text-xs tabular-nums">{tables.length}</span>
        </h2>
        {tables.length === 0 ? (
          <p className="mt-2 text-sm text-mocha">{live.loaded ? "No dine-in tables with an open order." : "Loading…"}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
            {tables.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => showOrder(order)}
                  className="flex w-full flex-col items-start rounded-2xl bg-cream px-3 py-2.5 text-left ring-1 ring-espresso/10 transition-colors hover:bg-oat/60"
                >
                  <span className="text-lg leading-tight font-extrabold">Table {order.table_number}</span>
                  <span className="text-sm font-semibold text-coffee">{order.order_number}</span>
                  <span className="text-xs text-mocha">{statusLabel(order.order_type, order.status as OrderStatus)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Order board"
        className="no-scrollbar -mx-4 mt-6 grid snap-x snap-mandatory auto-cols-[min(88vw,22rem)] grid-flow-col gap-4 overflow-x-auto px-4 pb-4 lg:mx-0 lg:auto-cols-[minmax(17rem,1fr)] lg:px-0"
      >
        {COLUMNS.map((column) => {
          const items = active.filter((o) => o.status === column.status);
          return (
            <div key={column.status} className="snap-start">
              <h2 className="sticky top-0 flex items-center justify-between rounded-2xl bg-oat/80 px-4 py-2.5 font-semibold backdrop-blur">
                {column.title}
                <span className="grid h-7 min-w-7 place-items-center rounded-full bg-espresso px-2 text-sm text-foam tabular-nums">{items.length}</span>
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {items.length === 0 && <p className="rounded-2xl border border-dashed border-espresso/15 p-6 text-center text-sm text-mocha">No orders</p>}
                {items.map((order) => (
                  <AdminOrderCard
                    key={order.id}
                    id={cardId(order.id)}
                    order={order}
                    adjustments={live.adjustments.get(order.id)}
                    quickExtras={extras}
                    onAddItem={() => additions.openAddItem(order)}
                    onQuickAdd={(extra) => additions.quickAdd(order, extra)}
                    now={now || new Date(order.created_at).getTime()}
                    highlight={isHighlighted(order.id)}
                    pending={live.pending.has(order.id)}
                    onAdvance={(to) => void live.changeStatus(order, to)}
                    onCancel={() => setCancelling(order)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <ConfirmDialog
        open={cancelling !== null}
        title={`Cancel ${cancelling?.order_number ?? "order"}?`}
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        busyLabel="Cancelling…"
        busy={cancelling ? live.pending.has(cancelling.id) : false}
        onConfirm={async () => {
          if (!cancelling) return;
          await live.changeStatus(cancelling, "cancelled");
          setCancelling(null);
        }}
        onCancel={() => setCancelling(null)}
      >
        <p>The customer will see this order as cancelled. This can&apos;t be undone.</p>
      </ConfirmDialog>
      {additions.element}
    </div>
  );
}

function Mini({ label, value, loaded }: { label: string; value: string; loaded: boolean }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-espresso/5">
      <p className="text-xs text-mocha">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{loaded ? value : "–"}</p>
    </div>
  );
}
