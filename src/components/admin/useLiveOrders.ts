"use client";

// Live staff data: active orders (any day) + today's orders for the stats.
// Updates instantly via Supabase Realtime (admins only, enforced by RLS), with a
// 30-second re-check as a fallback. Status changes go only through the
// database's update_order_status() function.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_ORDER_COLUMNS, statusErrorMessage, type AdminOrder } from "@/lib/orders/admin";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { manilaDayRange } from "@/lib/time";

export type TodayOrder = Pick<AdminOrder, "id" | "status" | "order_type" | "total" | "created_at">;

const POLL_MS = 30_000;

export function useLiveOrders({ onNewOrders }: { onNewOrders?: (orders: AdminOrder[]) => void } = {}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [today, setToday] = useState<TodayOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<"live" | "polling">("polling");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNewOrders);
  useEffect(() => {
    onNewRef.current = onNewOrders;
  }, [onNewOrders]);

  const load = useCallback(async () => {
    const { start } = manilaDayRange();
    const [active, todays] = await Promise.all([
      supabase.from("orders").select(ADMIN_ORDER_COLUMNS).in("status", ACTIVE_STATUSES).order("created_at", { ascending: true }),
      supabase.from("orders").select("id, status, order_type, total, created_at").gte("created_at", start),
    ]);
    if (active.error || todays.error) {
      setError("Couldn't load orders. Check your connection; retrying automatically.");
      return;
    }
    const list = (active.data ?? []) as unknown as AdminOrder[];
    for (const order of list) order.order_items.sort((a, b) => a.line_number - b.line_number);

    // New-order detection (skipped on the very first load).
    if (known.current) {
      const fresh = list.filter((o) => !known.current!.has(o.id) && o.status === "received");
      if (fresh.length > 0) onNewRef.current?.(fresh);
    }
    known.current = new Set([...(known.current ?? []), ...list.map((o) => o.id), ...(todays.data ?? []).map((o) => o.id)]);

    setOrders(list);
    setToday((todays.data ?? []) as TodayOrder[]);
    setError(null);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const channel = supabase
      .channel("staff-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void load();
      })
      .subscribe((status) => setConnection(status === "SUBSCRIBED" ? "live" : "polling"));

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  /** Move an order to `to`. Ignored while a change for the same order is in flight. */
  const changeStatus = useCallback(
    async (order: Pick<AdminOrder, "id" | "status">, to: OrderStatus) => {
      // Synchronous guard: a double tap can't send two changes for one order.
      if (pendingRef.current.has(order.id)) return false;
      pendingRef.current.add(order.id);
      setPending(new Set(pendingRef.current));
      try {
        const { error: rpcError } = await supabase.rpc("update_order_status", {
          p_order_id: order.id,
          p_from_status: order.status as OrderStatus,
          p_to_status: to,
        });
        setNotice(rpcError ? statusErrorMessage(rpcError.message) : null);
        await load();
        return !rpcError;
      } finally {
        pendingRef.current.delete(order.id);
        setPending(new Set(pendingRef.current));
      }
    },
    [supabase, load],
  );

  return { orders, today, loaded, connection, error, notice, dismissNotice: () => setNotice(null), pending, changeStatus, reload: load };
}
