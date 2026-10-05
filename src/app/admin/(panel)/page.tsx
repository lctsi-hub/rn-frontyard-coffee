import type { Metadata } from "next";
import { LiveDashboard } from "@/components/admin/LiveDashboard";
import { getMenu } from "@/lib/menu";
import { resolveQuickExtras } from "@/lib/orders/staff-items";

export const metadata: Metadata = { title: "Live orders" };

export default async function AdminDashboardPage() {
  // Menu with today's Sold out switches, for "+ Add Item" (prices are re-checked on the server).
  const menu = await getMenu();
  return <LiveDashboard menu={menu} extras={resolveQuickExtras(menu)} />;
}
