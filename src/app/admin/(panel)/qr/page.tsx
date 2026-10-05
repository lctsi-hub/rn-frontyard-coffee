import type { Metadata } from "next";
import { QrCodeSheet } from "@/components/admin/QrCodeSheet";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "QR codes" };

export default async function QrCodesPage() {
  await requireAdmin();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? null;
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold print:hidden">QR codes</h1>
      <p className="mt-1 text-sm text-mocha print:hidden">
        One general code for the counter, and one per table (it opens the menu with that table already chosen).
      </p>
      <div className="mt-5">
        <QrCodeSheet defaultBaseUrl={siteUrl && !siteUrl.includes("localhost") ? siteUrl : null} />
      </div>
    </div>
  );
}
