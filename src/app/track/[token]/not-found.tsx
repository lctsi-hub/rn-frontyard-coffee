import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function OrderNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo className="w-28 text-espresso" />
      <h1 className="font-display mt-8 text-3xl font-semibold">Order not found</h1>
      <p className="mt-2 text-mocha">Please check your tracking link, or ask our staff for help.</p>
      <Link
        href="/order"
        className="mt-8 flex h-14 items-center rounded-full bg-espresso px-7 font-semibold text-foam shadow-lift transition-transform active:scale-[0.97]"
      >
        Back to Menu
      </Link>
    </main>
  );
}
