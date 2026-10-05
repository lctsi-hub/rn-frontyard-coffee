"use client";

import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Sparkle } from "@/components/brand/Sparkle";
import { useHydrated } from "@/hooks/useHydrated";
import { formatPeso } from "@/lib/format";
import { withTable } from "@/lib/table";
import { useRecentOrder, type RecentOrder } from "@/stores/recent-order";

function messageFor(order: RecentOrder) {
  switch (order.orderType) {
    case "dine_in":
      return order.tableNumber
        ? `Sit back and relax. We'll bring your order to Table ${order.tableNumber}.`
        : "Sit back and relax. We'll bring your order to your table.";
    case "take_out":
      return "We'll let you know when your order is ready for pickup at the counter.";
    case "delivery":
      return "We're on it! Your order will be delivered to you once it's ready.";
  }
}

export function OrderReceived({ tableFromLink }: { tableFromLink: number | null }) {
  const hydrated = useHydrated();
  const order = useRecentOrder();
  const menuHref = withTable("/order", tableFromLink);

  if (!hydrated) {
    return <main aria-busy="true" className="min-h-dvh" />;
  }

  if (!order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <Logo className="w-32 text-espresso" />
        <h1 className="font-display mt-8 text-2xl font-semibold">No recent order on this phone</h1>
        <p className="mt-2 text-mocha">If you just ordered, check your tracking link or ask our staff.</p>
        <Link
          href={menuHref}
          className="mt-8 flex h-14 items-center gap-2 rounded-full bg-espresso px-7 font-semibold text-foam shadow-lift transition-transform active:scale-[0.97]"
        >
          Back to Menu <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center overflow-hidden px-6 pt-safe pb-safe text-center">
      <Sparkle className="absolute top-[12%] left-[12%] size-4 animate-twinkle text-honey" />
      <Sparkle className="absolute top-[20%] right-[14%] size-5 animate-twinkle text-honey [animation-delay:0.8s]" />
      <Sparkle className="absolute top-[38%] left-[8%] size-3 animate-twinkle text-honey [animation-delay:1.6s]" />

      <Logo className="w-28 animate-fade-up text-espresso" />

      <div className="mt-10 grid size-24 animate-pop place-items-center rounded-full bg-espresso text-honey shadow-lift [animation-delay:150ms]">
        <Check className="size-12" strokeWidth={2.5} />
      </div>

      <h1 className="font-display mt-7 animate-fade-up text-[2.25rem] leading-tight font-semibold [animation-delay:250ms]">
        Order Received! ☕
      </h1>
      <p className="mt-3 animate-fade-up text-mocha [animation-delay:320ms]">Order number</p>
      <p className="font-display animate-fade-up text-5xl font-bold tracking-tight [animation-delay:380ms]">
        #{order.orderNumber}
      </p>

      <p className="mt-6 max-w-xs animate-fade-up leading-relaxed text-coffee [animation-delay:450ms]">{messageFor(order)}</p>

      <div className="mt-6 flex animate-fade-up items-center gap-2 rounded-full bg-foam px-4 py-2 text-sm shadow-card ring-1 ring-espresso/5 [animation-delay:520ms]">
        <Clock className="size-4 text-caramel" />
        <span>
          Total <span className="font-semibold tabular-nums">{formatPeso(order.total)}</span>
        </span>
      </div>

      <div className="mt-auto flex w-full flex-col gap-3 pt-10">
        <Link
          href={`/track/${order.trackingToken}`}
          className="flex h-16 w-full animate-fade-up items-center justify-center gap-2 rounded-full bg-espresso text-lg font-semibold text-foam shadow-lift transition-transform active:scale-[0.97] [animation-delay:600ms]"
        >
          Track My Order <ArrowRight className="size-5" strokeWidth={2.5} />
        </Link>
        <Link
          href={menuHref}
          className="flex h-14 w-full animate-fade-up items-center justify-center rounded-full font-semibold text-coffee ring-1 ring-espresso/15 transition-colors active:bg-oat [animation-delay:650ms]"
        >
          Back to Menu
        </Link>
        <p className="animate-fade-up text-xs text-mocha [animation-delay:700ms]">
          Tip: keep your order number. You can reopen tracking from the menu on this phone.
        </p>
      </div>
    </main>
  );
}
