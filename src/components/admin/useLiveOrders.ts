"use client";

// Live staff data: active orders (any day) + today's orders for the stats.
// Updates instantly via Supabase Realtime (admins only, enforced by RLS), with a
// 30-second re-check as a fallback. Status changes go only through the
// database's update_order_status() function.
//
// Items staff added after checkout come from order_adjustments (audit trail).
// If that table doesn't exist yet (migration not applied), the board simply
// shows no "added" marks.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADJUSTMENT_COLUMNS, ADMIN_ORDER_COLUMNS, statusErrorMessage, type AdminOrder, type OrderAdjustment } from "@/lib/orders/admin";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { manilaDayRange } from "@/lib/time";

export type TodayOrder = Pick<AdminOrder, "id" | "status" | "order_type" | "total" | "created_at">;

const POLL_MS = 30_000;

export function useLiveOrders({
  onNewOrders,
  onNewAdditions,
}: { onNewOrders?: (orders: AdminOrder[]) => void; onNewAdditions?: (additions: OrderAdjustment[]) => void } = {}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [today, setToday] = useState<TodayOrder[]>([]);
  const [adjustments, setAdjustments] = useState<Map<string, OrderAdjustment[]>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<"live" | "polling">("polling");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);
  const knownAdditions = useRef<Set<number> | null>(null);
  const onNewRef = useRef(onNewOrders);
  const onNewAdditionsRef = useRef(onNewAdditions);
  useEffect(() => {
    onNewRef.current = onNewOrders;
    onNewAdditionsRef.current = onNewAdditions;
  }, [onNewOrders, onNewAdditions]);

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

    // Items added after checkout (optional: table exists once the migration is applied).
    const byOrder = new Map<string, OrderAdjustment[]>();
    if (list.length > 0) {
      const added = await supabase
        .from("order_adjustments")
        .select(ADJUSTMENT_COLUMNS)
        .in("order_id", list.map((o) => o.id))
        .order("created_at", { ascending: true });
      if (!added.error) {
        const rows = (added.data ?? []) as OrderAdjustment[];
        for (const row of rows) byOrder.set(row.order_id, [...(byOrder.get(row.order_id) ?? []), row]);
        if (knownAdditions.current) {
          const fresh = rows.filter((r) => !knownAdditions.current!.has(r.id) && !r.acknowledged_at);
          if (fresh.length > 0) onNewAdditionsRef.current?.(fresh);
        }
        knownAdditions.current = new Set([...(knownAdditions.current ?? []), ...rows.map((r) => r.id)]);
      }
    } else {
      knownAdditions.current ??= new Set();
    }

    setOrders(list);
    setAdjustments(byOrder);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "order_adjustments" }, () => {
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

  /** Kitchen "Got it": clear the NEW / ADDED marks on an order. */
  const acknowledgeAdditions = useCallback(
    async (orderId: string) => {
      const { error: rpcError } = await supabase.rpc("acknowledge_order_additions", { p_order_id: orderId });
      if (rpcError) setNotice("Couldn't mark the added items as seen. Please try again.");
      await load();
    },
    [supabase, load],
  );

  return { orders, today, adjustments, acknowledgeAdditions, loaded, connection, error, notice, dismissNotice: () => setNotice(null), pending, changeStatus, reload: load };
}
