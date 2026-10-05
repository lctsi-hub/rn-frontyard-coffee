"use client";

import Link from "next/link";
import { ChevronRight, ReceiptText } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { useRecentOrder } from "@/stores/recent-order";

/** "Track your order RN-0007" shortcut, shown for 24 hours after ordering on this phone. */
export function RecentOrderBanner() {
  const hydrated = useHydrated();
  const order = useRecentOrder();
  if (!hydrated || !order) return null;

  return (
    <Link
      href={`/track/${order.trackingToken}`}
      className="mt-4 flex animate-fade-up items-center gap-3 rounded-2xl bg-foam px-4 py-3 shadow-card ring-1 ring-espresso/5 transition-transform active:scale-[0.98]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-oat text-caramel">
        <ReceiptText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-mocha">Your recent order</span>
        <span className="block font-semibold">Track #{order.orderNumber}</span>
      </span>
      <ChevronRight className="size-5 text-mocha" />
    </Link>
  );
}
