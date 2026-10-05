import type { Metadata } from "next";
import { OrderReceived } from "@/components/order/OrderReceived";
import { parseTableParam } from "@/lib/table";

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false },
};

export default async function OrderReceivedPage({ searchParams }: PageProps<"/order/received">) {
  const table = parseTableParam((await searchParams).table);
  return <OrderReceived tableFromLink={table} />;
}
