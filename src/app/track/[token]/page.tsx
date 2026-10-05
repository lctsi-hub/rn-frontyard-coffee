import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackingView } from "@/components/tracking/TrackingView";
import { getOrderTracking } from "@/lib/orders/place-order";

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
  // The URL contains the customer's private tracking token: never send it to other sites.
  referrer: "no-referrer",
};

export default async function TrackOrderPage({ params }: PageProps<"/track/[token]">) {
  const { token } = await params;
  const order = await getOrderTracking(token);
  // Same response for malformed, unknown or removed tokens: nothing is revealed.
  if (!order) notFound();
  return <TrackingView order={order} />;
}
