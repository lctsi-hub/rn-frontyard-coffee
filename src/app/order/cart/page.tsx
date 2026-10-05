import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { OrderHeader } from "@/components/order/OrderHeader";
import { getStoreSettings } from "@/lib/settings";
import { parseTableParam } from "@/lib/table";

export const metadata: Metadata = {
  title: "Your cart",
};

export default async function CartPage({ searchParams }: PageProps<"/order/cart">) {
  const table = parseTableParam((await searchParams).table);
  const settings = await getStoreSettings();

  return (
    <div className="min-h-dvh">
      <OrderHeader table={table} title="Your cart" backHref="/order" backLabel="Back to menu" />
      <CartView table={table} settings={settings} />
    </div>
  );
}
