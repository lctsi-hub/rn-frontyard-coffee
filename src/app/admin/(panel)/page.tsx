import type { Metadata } from "next";
import { LiveDashboard } from "@/components/admin/LiveDashboard";

export const metadata: Metadata = { title: "Live orders" };

export default function AdminDashboardPage() {
  return <LiveDashboard />;
}
