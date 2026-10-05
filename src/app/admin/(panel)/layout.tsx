import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/admin/auth-actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/brand/Logo";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · RN Frontyard Coffee" },
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh bg-[#f3ece1]">
      <header className="sticky top-0 z-30 border-b border-espresso/10 bg-[#f3ece1]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[110rem] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo className="h-9 text-espresso" />
            <span className="eyebrow hidden text-mocha sm:inline">Staff dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-coffee sm:inline">{admin.displayName}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-coffee ring-1 ring-espresso/10 hover:bg-oat/60"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-[110rem] px-4 pb-3">
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-[110rem] px-4 py-6 pb-safe">{children}</main>
    </div>
  );
}
