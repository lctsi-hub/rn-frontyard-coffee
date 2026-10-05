import { Sparkle } from "@/components/brand/Sparkle";

export function TableBanner({ table }: { table: number | null }) {
  if (!table) {
    return (
      <p className="mt-4 rounded-2xl bg-oat/60 px-4 py-3 text-sm text-coffee">
        Dining in? You can pick your table number at checkout.
      </p>
    );
  }

  return (
    <div
      role="status"
      className="relative mt-5 flex items-center gap-4 overflow-hidden rounded-[1.75rem] bg-espresso p-4 text-foam shadow-lift"
    >
      <Sparkle className="absolute top-3 right-4 size-4 animate-twinkle text-honey" />
      <Sparkle className="absolute right-12 bottom-3 size-2.5 animate-twinkle text-honey [animation-delay:1.4s]" />
      <span className="font-display grid size-14 shrink-0 place-items-center rounded-2xl bg-foam text-2xl font-bold text-espresso">
        {table}
      </span>
      <p className="leading-tight">
        <span className="block text-sm text-foam/70">You&apos;re ordering for</span>
        <span className="font-display text-2xl font-semibold">Table {table}</span>
      </p>
    </div>
  );
}
