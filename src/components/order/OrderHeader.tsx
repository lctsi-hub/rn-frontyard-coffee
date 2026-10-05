import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { withTable } from "@/lib/table";

export function OrderHeader({
  table,
  title,
  backHref = "/",
  backLabel = "Back to welcome screen",
}: {
  table: number | null;
  /** Page title shown instead of the logo (e.g. "Your cart"). */
  title?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-cream/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-(--header-h) max-w-md items-center justify-between gap-2 px-3">
        <Link
          href={withTable(backHref, table)}
          aria-label={backLabel}
          className="flex h-11 min-w-0 items-center gap-0.5 rounded-full pr-3 pl-1 text-espresso transition-colors active:bg-oat"
        >
          <ChevronLeft className="size-5 shrink-0" strokeWidth={2.5} />
          {title ? <span className="font-display truncate text-xl font-semibold">{title}</span> : <Logo className="h-8" />}
        </Link>

        {table ? (
          <span className="shrink-0 rounded-full bg-espresso px-3.5 py-1.5 text-sm font-semibold text-foam">
            Table {table}
          </span>
        ) : (
          <span className="eyebrow shrink-0 text-mocha">{title ? "Order" : "Menu"}</span>
        )}
      </div>
    </header>
  );
}
