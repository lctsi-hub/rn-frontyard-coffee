import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AddedAfterCheckout, addedItems, OrderItemsList } from "@/components/admin/AdminOrderCard";
import { AddItemButton, AddItemProvider } from "@/components/admin/HistoryAddItem";
import { requireAdmin } from "@/lib/auth/admin";
import { formatPeso } from "@/lib/format";
import { getMenu } from "@/lib/menu";
import { ADJUSTMENT_COLUMNS, ADMIN_ORDER_COLUMNS, isOrderStatus, PAYMENT_LABELS, type AdminOrder, type OrderAdjustment } from "@/lib/orders/admin";
import { canAddItems, resolveQuickExtras } from "@/lib/orders/staff-items";
import { ORDER_TYPE_NAMES, statusLabel, type OrderStatus } from "@/lib/orders/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, isValidDateString, manilaDateString, manilaDayRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { OrderType } from "@/types/order";

export const metadata: Metadata = { title: "Order history" };

const LIMIT = 300;
const TYPES: OrderType[] = ["dine_in", "take_out", "delivery"];
const STATUSES: OrderStatus[] = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];

/** "12", "RN-12", "rn-0012" → "RN-0012". */
function orderNumberFromSearch(q: string) {
  const digits = q.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return `RN-${n < 10000 ? String(n).padStart(4, "0") : String(n)}`;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function OrderHistoryPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const params = await searchParams;
  const date = isValidDateString(one(params.date)) ? one(params.date) : manilaDateString();
  const type = TYPES.includes(one(params.type) as OrderType) ? (one(params.type) as OrderType) : "";
  const status = isOrderStatus(one(params.status)) ? (one(params.status) as OrderStatus) : "";
  const q = one(params.q).trim().slice(0, 20);
  const orderNumber = q ? orderNumberFromSearch(q) : null;

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("orders").select(ADMIN_ORDER_COLUMNS).order("created_at", { ascending: false }).limit(LIMIT);
  if (orderNumber) {
    query = query.eq("order_number", orderNumber); // number search covers all dates
  } else {
    const { start, end } = manilaDayRange(date);
    query = query.gte("created_at", start).lt("created_at", end);
  }
  if (type) query = query.eq("order_type", type);
  if (status) query = query.eq("status", status);

  const [{ data, error }, menu] = await Promise.all([query, getMenu()]);
  const orders = (data ?? []) as unknown as AdminOrder[];
  for (const order of orders) order.order_items.sort((a, b) => a.line_number - b.line_number);

  // Items added after checkout (audit trail). Optional until the migration is applied.
  const adjustments = new Map<string, OrderAdjustment[]>();
  if (orders.length > 0) {
    const added = await supabase
      .from("order_adjustments")
      .select(ADJUSTMENT_COLUMNS)
      .in("order_id", orders.map((o) => o.id))
      .order("created_at", { ascending: true });
    for (const row of (added.error ? [] : (added.data ?? [])) as OrderAdjustment[]) {
      adjustments.set(row.order_id, [...(adjustments.get(row.order_id) ?? []), row]);
    }
  }
  const counted = orders.filter((o) => o.status !== "cancelled");
  const totalValue = counted.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <AddItemProvider menu={menu} extras={resolveQuickExtras(menu)}>
      <h1 className="font-display text-3xl font-semibold">Order history</h1>

      <form method="get" className="mt-4 grid gap-3 rounded-3xl bg-white p-4 shadow-card ring-1 ring-espresso/5 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Date
          <input type="date" name="date" defaultValue={date} className="h-11 rounded-xl bg-cream px-3 font-normal ring-1 ring-espresso/10" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Order type
          <select name="type" defaultValue={type} className="h-11 rounded-xl bg-cream px-3 font-normal ring-1 ring-espresso/10">
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {ORDER_TYPE_NAMES[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Status
          <select name="status" defaultValue={status} className="h-11 rounded-xl bg-cream px-3 font-normal ring-1 ring-espresso/10">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel("take_out", s).replace("Ready for Pickup", "Ready")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          RN number
          <input type="search" name="q" defaultValue={q} placeholder="e.g. 12 or RN-0012" className="h-11 rounded-xl bg-cream px-3 font-normal ring-1 ring-espresso/10" />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full bg-espresso px-5 font-semibold text-foam">
            <Search className="size-4" /> Filter
          </button>
          <Link href="/admin/orders" className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-coffee ring-1 ring-espresso/15">
            Today
          </Link>
        </div>
      </form>

      <p className="mt-4 text-sm text-coffee">
        {orderNumber ? `Searching all dates for ${orderNumber}` : `Showing ${date}`}
        {type ? ` · ${ORDER_TYPE_NAMES[type]}` : ""}
        {status ? ` · ${statusLabel("take_out", status)}` : ""}
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl bg-berry/10 p-4 text-berry">Couldn&apos;t load orders. Please try again.</p>
      ) : (
        <>
          <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Orders" value={String(orders.length)} />
            <Stat label="Total value (excl. cancelled)" value={formatPeso(totalValue)} />
            <Stat label="Completed" value={String(orders.filter((o) => o.status === "completed").length)} />
            <Stat label="Cancelled" value={String(orders.filter((o) => o.status === "cancelled").length)} />
          </section>
          {orders.length >= LIMIT && <p className="mt-2 text-xs text-mocha">Showing the latest {LIMIT}. Narrow the filters to see more.</p>}

          <ul className="mt-4 flex flex-col gap-2">
            {orders.length === 0 && <li className="rounded-2xl border border-dashed border-espresso/15 p-8 text-center text-mocha">No orders match these filters.</li>}
            {orders.map((order) => (
              <li key={order.id}>
                <details className="group rounded-2xl bg-white shadow-card ring-1 ring-espresso/5">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="font-display text-lg font-bold">{order.order_number}</span>
                    <span className="text-sm text-mocha">{formatDateTime(order.created_at)}</span>
                    <span className="text-sm">
                      {ORDER_TYPE_NAMES[order.order_type]}
                      {order.order_type === "dine_in" && order.table_number ? (
                        <span className="ml-1.5 rounded-md bg-espresso px-1.5 py-0.5 text-xs font-extrabold text-foam">TABLE {order.table_number}</span>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-coffee">{order.customer_name}</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        order.status === "cancelled" ? "bg-berry/15 text-berry" : order.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-honey/40",
                      )}
                    >
                      {statusLabel(order.order_type, order.status as OrderStatus)}
                    </span>
                    <span className="font-semibold tabular-nums">{formatPeso(Number(order.total))}</span>
                  </summary>
                  <div className="grid gap-4 border-t border-dashed border-espresso/15 px-4 py-4 text-sm md:grid-cols-2">
                    <div>
                      <OrderItemsList order={order} added={addedItems(adjustments.get(order.id))} />
                      {adjustments.get(order.id)?.length ? <AddedAfterCheckout order={order} adjustments={adjustments.get(order.id)!} /> : null}
                      {canAddItems(order.status) && (
                        <div className="mt-3">
                          <AddItemButton
                            order={{
                              id: order.id,
                              order_number: order.order_number,
                              table_number: order.table_number,
                              order_type: order.order_type,
                              payment_method: order.payment_method,
                              total: order.total,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <dl className="space-y-1">
                      <Row label="Customer" value={order.customer_name} />
                      {order.customer_phone && <Row label="Mobile" value={order.customer_phone} />}
                      {order.order_type === "delivery" && (
                        <>
                          <Row label="Barangay" value={order.delivery_area_name ?? ""} />
                          <Row label="Address" value={order.delivery_address ?? ""} />
                          <Row label="Landmark" value={order.delivery_landmark ?? ""} />
                          {order.delivery_instructions && <Row label="Instructions" value={order.delivery_instructions} />}
                        </>
                      )}
                      {order.notes && <Row label="Notes" value={order.notes} />}
                      <Row label="Payment" value={PAYMENT_LABELS[order.payment_method]} />
                      <Row label="Subtotal" value={formatPeso(Number(order.subtotal))} />
                      {order.order_type === "delivery" && <Row label="Delivery fee" value={formatPeso(Number(order.delivery_fee))} />}
                      <Row label="Total" value={formatPeso(Number(order.total))} />
                    </dl>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </AddItemProvider>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-espresso/5">
      <p className="text-xs text-mocha">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-mocha">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
