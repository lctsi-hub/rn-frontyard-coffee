import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Kitchen & Bar",
  robots: { index: false, follow: false },
};

export default async function KitchenLayout({ children }: LayoutProps<"/kitchen">) {
  await requireAdmin();
  return children;
}
