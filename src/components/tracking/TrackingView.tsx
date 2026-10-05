"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, Check, ChefHat, CircleCheckBig, Coffee, ReceiptText, RefreshCw, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { formatPeso } from "@/lib/format";
import {
  customerMessage,
  customerStageIndex,
  customerStages,
  ORDER_TYPE_NAMES,
  statusLabel,
  type OrderStatus,
} from "@/lib/orders/status";
import type { TrackingOrder } from "@/lib/orders/tracking";
import { cn } from "@/lib/utils";

const REFRESH_MS = 15_000;
const PAYMENT_LABELS = { cash: "Cash", gcash: "GCash", counter: "Pay at Counter" } as const;
const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const formatTime = (iso: string) => (iso ? timeFormat.format(new Date(iso)) : "");

const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  received: ReceiptText,
  confirmed: Check,
  preparing: ChefHat,
  ready: Coffee,
  out_for_delivery: Bike,
  completed: CircleCheckBig,
  cancelled: XCircle,
};

export function TrackingView({ order }: { order: TrackingOrder }) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState(() => order.timeline.at(-1)?.at ?? order.createdAt);
  const isFinal = order.status === "completed" || order.status === "cancelled";

  // Keep the page current while the order is in progress.
  useEffect(() => {
    if (isFinal) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isFinal, router]);

  // Note when fresh data arrives (the server re-renders this component with a new order).
  useEffect(() => {
    const id = window.setTimeout(() => setLastUpdated(new Date().toISOString()), 0);
    return () => window.clearTimeout(id);
  }, [order]);

  const cancelled = order.status === "cancelled";
  const stages = customerStages(order.orderType);
  const current = customerStageIndex(order.orderType, order.status);
  const reachedAt = new Map(order.timeline.map((t) => [t.status, t.at]));
  const HeroIcon = STATUS_ICONS[order.status] ?? ReceiptText;

  return (
    <main className="mx-auto max-w-md px-4 pt-safe pb-safe">
      <header className="flex flex-col items-center text-center">
        <Logo className="w-24 text-espresso" />
        <p className="eyebrow mt-3 text-mocha">Order tracking</p>
        <h1 className="font-display mt-1 text-4xl font-bold tracking-tight">#{order.orderNumber}</h1>
        <p className="mt-1 text-sm text-coffee">
          {order.firstName ? `Hi ${order.firstName}! · ` : ""}
          {ORDER_TYPE_NAMES[order.orderType]}
          {order.orderType === "dine_in" && order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
        </p>
      </header>

      <section
        aria-live="polite"
        className={cn(
          "mt-6 flex animate-fade-up items-center gap-4 rounded-[1.75rem] p-5 shadow-lift",
          cancelled ? "bg-berry text-foam" : "bg-espresso text-foam",
        )}
      >
        <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", cancelled ? "bg-foam/15" : "bg-foam/10 text-honey")}>
          <HeroIcon className={cn("size-7", !isFinal && "animate-bob")} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight font-semibold">{statusLabel(order.orderType, order.status)}</p>
          <p className="mt-1 text-sm text-foam/80">{customerMessage(order.orderType, order.status, order.tableNumber)}</p>
        </div>
      </section>

      {!cancelled && (
        <ol aria-label="Order progress" className="mt-6 rounded-[1.75rem] bg-foam p-5 shadow-card ring-1 ring-espresso/5">
          {stages.map((stage, i) => {
            const done = i < current || order.status === "completed";
            const active = i === current && order.status !== "completed";
            const time = reachedAt.get(stage);
            return (
              <li key={stage} className="relative flex gap-4 pb-5 last:pb-0">
                {i < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5 rounded-full", done ? "bg-espresso" : "bg-oat")}
                  />
                )}
                <span
                  className={cn(
                    "relative grid size-8 shrink-0 place-items-center rounded-full transition-colors",
                    done && "bg-espresso text-foam",
                    active && "bg-honey text-espresso ring-4 ring-honey/30",
                    !done && !active && "bg-oat text-mocha/60",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : <span className="size-2 rounded-full bg-current" />}
                  {active && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-honey/40" />}
                </span>
                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pt-1">
                  <span className={cn("font-semibold", !done && !active && "text-mocha/70")}>
                    {statusLabel(order.orderType, stage)}
                    {active && <span className="sr-only"> (current)</span>}
                  </span>
                  {time && <span className="shrink-0 text-xs text-mocha tabular-nums">{formatTime(time)}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section aria-labelledby="items-title" className="mt-6 rounded-[1.75rem] bg-foam p-5 shadow-card ring-1 ring-espresso/5">
        <h2 id="items-title" className="eyebrow text-mocha">
          Your order
        </h2>
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-oat px-1 text-xs font-bold tabular-nums">
                {item.quantity}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">{item.name}</p>
                {(item.size || item.options.length > 0) && (
                  <p className="text-coffee">{[item.size, ...item.options].filter(Boolean).join(" · ")}</p>
                )}
                {item.addons.map((a) => (
                  <p key={a} className="text-mocha">
                    + {a}
                  </p>
                ))}
                {item.notes && <p className="break-words text-coffee italic">“{item.notes}”</p>}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatPeso(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-dashed border-espresso/15 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-mocha">Subtotal</dt>
            <dd className="tabular-nums">{formatPeso(order.subtotal)}</dd>
          </div>
          {order.orderType === "delivery" && (
            <div className="flex justify-between">
              <dt className="text-mocha">Delivery fee</dt>
              <dd className="tabular-nums">{order.deliveryFee === 0 ? "FREE" : formatPeso(order.deliveryFee)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="font-semibold">Total</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{formatPeso(order.total)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-xs text-mocha">
            <dt>Payment</dt>
            <dd>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-6 flex flex-col items-center gap-4 text-center">
        {!isFinal && (
          <p className="flex items-center gap-1.5 text-xs text-mocha">
            <RefreshCw className="size-3.5" /> Updates automatically · last checked {formatTime(lastUpdated)}
          </p>
        )}
        <Link
          href="/order"
          className="flex h-14 w-full items-center justify-center rounded-full font-semibold text-coffee ring-1 ring-espresso/15 transition-colors active:bg-oat"
        >
          Back to Menu
        </Link>
      </footer>
    </main>
  );
}
