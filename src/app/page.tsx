import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Sparkle } from "@/components/brand/Sparkle";
import { AmbientBackground } from "@/components/landing/AmbientBackground";
import { SteamingCup } from "@/components/landing/SteamingCup";
import { isDeliveryAvailable } from "@/lib/checkout";
import { getStoreSettings } from "@/lib/settings";
import { STORE, STORE_LOCATION_LABEL } from "@/lib/store";
import { parseTableParam, withTable } from "@/lib/table";

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const table = parseTableParam((await searchParams).table);
  const settings = await getStoreSettings();
  const orderTypes = isDeliveryAvailable(settings) ? "Dine in · Take out · Delivery" : "Dine in · Take out";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <AmbientBackground />

      <div className="pt-safe pb-safe relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6">
        <header className="flex animate-fade-up flex-col items-center text-espresso">
          <h1>
            <Logo className="w-44 sm:w-52" />
            <span className="sr-only">{STORE.name}</span>
          </h1>
        </header>

        <div className="flex flex-1 items-center justify-center py-4">
          <SteamingCup className="w-full max-w-[17rem] animate-fade-up [animation-delay:150ms]" />
        </div>

        <section className="flex flex-col items-center text-center">
          <p className="font-display animate-fade-up text-[2rem] leading-[1.1] font-semibold text-balance [animation-delay:300ms]">
            Freshly brewed, right in your front yard.
          </p>
          <p className="mt-3 max-w-xs animate-fade-up text-[0.95rem] leading-relaxed text-mocha [animation-delay:400ms]">
            Browse the menu and order from your phone. No sign-up needed.
          </p>

          {table && (
            <p className="mt-5 inline-flex animate-fade-up items-center gap-2 rounded-full bg-foam px-4 py-2 text-sm font-semibold shadow-card ring-1 ring-espresso/5 [animation-delay:450ms]">
              <Sparkle className="size-3.5 text-caramel" />
              Ordering for Table {table}
            </p>
          )}

          <Link
            href={withTable("/order", table)}
            className="group relative isolate mt-7 flex h-16 w-full animate-fade-up items-center justify-center gap-3 overflow-hidden rounded-full bg-espresso pr-2 pl-8 text-lg font-semibold text-foam shadow-lift transition-transform duration-150 ease-out [animation-delay:550ms] active:scale-[0.97]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/3 animate-shine bg-linear-to-r from-transparent via-foam/20 to-transparent"
            />
            <span className="flex-1 text-left">Start Your Order</span>
            <span className="grid size-12 place-items-center rounded-full bg-foam text-espresso transition-transform duration-200 group-hover:translate-x-0.5 group-active:translate-x-1">
              <ArrowRight className="size-5" strokeWidth={2.5} />
            </span>
          </Link>

          <p className="eyebrow mt-5 animate-fade-up text-mocha [animation-delay:650ms]">{orderTypes}</p>
          <p className="mt-2 animate-fade-up text-xs text-mocha/80 [animation-delay:700ms]">{STORE_LOCATION_LABEL}</p>
        </section>
      </div>
    </main>
  );
}
