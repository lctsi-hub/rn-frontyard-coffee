import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { getStoreSettings } from "@/lib/settings";
import { parseTableParam } from "@/lib/table";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage({ searchParams }: PageProps<"/order/checkout">) {
  const table = parseTableParam((await searchParams).table);
  const settings = await getStoreSettings();

  return (
    <div className="min-h-dvh">
      <CheckoutFlow settings={settings} tableFromLink={table} />
    </div>
  );
}
