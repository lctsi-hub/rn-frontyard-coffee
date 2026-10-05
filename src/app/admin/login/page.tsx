import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/brand/Logo";
import { getAdminSession, safeNextPath } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const configured = isSupabaseConfigured();

  if (configured) {
    const session = await getAdminSession();
    if (session && session !== "not_admin") redirect(next);
  }

  const notice =
    params.error === "not_staff" ? "This account doesn't have staff access. Please ask the owner." : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up rounded-[2rem] bg-foam p-7 shadow-lift ring-1 ring-espresso/5">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-32 text-espresso" />
          <p className="eyebrow mt-4 text-caramel">Staff only</p>
          <h1 className="font-display mt-1 text-2xl font-semibold">Sign in to the dashboard</h1>
        </div>
        {configured ? (
          <LoginForm next={next} notice={notice} />
        ) : (
          <p className="mt-6 rounded-2xl bg-honey/30 p-4 text-sm text-espresso">Supabase isn&apos;t configured yet.</p>
        )}
        <p className="mt-6 text-center text-xs text-mocha">Staff accounts are created by the shop owner.</p>
      </div>
    </main>
  );
}
