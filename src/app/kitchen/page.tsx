import { KitchenBoard } from "@/components/admin/KitchenBoard";
import { getMenu } from "@/lib/menu";
import { resolveQuickExtras } from "@/lib/orders/staff-items";

export default async function KitchenPage() {
  // Menu with today's Sold out switches, for "+ Add Item" (prices are re-checked on the server).
  const menu = await getMenu();
  return <KitchenBoard menu={menu} extras={resolveQuickExtras(menu)} />;
}
