"use client";

import { Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { setAvailability, type AvailabilityResult } from "@/app/admin/(panel)/menu/actions";
import { cn } from "@/lib/utils";

export type MenuRow = { type: "product" | "addon"; key: string; name: string; detail: string; available: boolean; imageUrl: string | null };
export type MenuGroup = { title: string; rows: MenuRow[] };

export function MenuAvailabilityPanel({ groups }: { groups: MenuGroup[] }) {
  const [query, setQuery] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => r.name.toLowerCase().includes(q)) }))
      .filter((g) => g.rows.length > 0);
  }, [groups, query]);

  const soldOut = groups.flatMap((g) => g.rows).filter((r) => !r.available);

  const toggle = (row: MenuRow) => {
    const id = `${row.type}:${row.key}`;
    if (pendingKey) return;
    setPendingKey(id);
    startTransition(async () => {
      setResult(await setAvailability({ itemType: row.type, itemKey: row.key, available: !row.available }));
      setPendingKey(null);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mocha" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu…"
            className="h-11 w-full rounded-full bg-white pr-4 pl-9 ring-1 ring-espresso/10 focus:ring-2 focus:ring-espresso focus:outline-none"
          />
        </label>
        <p className="text-sm text-coffee">
          {soldOut.length === 0 ? "Everything is available." : `${soldOut.length} sold out: ${soldOut.map((r) => r.name).join(", ")}`}
        </p>
      </div>
      {result && !result.ok && <p className="mt-3 rounded-2xl bg-berry/10 px-4 py-3 text-sm font-semibold text-berry">{result.message}</p>}

      <div className="mt-5 flex flex-col gap-6">
        {filtered.map((group) => (
          <section key={group.title}>
            <h2 className="font-display text-xl font-semibold">{group.title}</h2>
            <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {group.rows.map((row) => {
                const id = `${row.type}:${row.key}`;
                return (
                  <li key={id} className={cn("flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-espresso/5", !row.available && "bg-cream/70")}>
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small local thumbnails
                      <img src={row.imageUrl} alt="" className={cn("size-12 shrink-0 rounded-xl object-cover", !row.available && "grayscale")} />
                    ) : (
                      <span className="size-12 shrink-0 rounded-xl bg-oat" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-semibold", !row.available && "text-espresso/60")}>{row.name}</p>
                      <p className="truncate text-xs text-mocha">{row.detail}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.available}
                      aria-label={`${row.name}: ${row.available ? "available" : "sold out"}`}
                      disabled={pendingKey !== null}
                      onClick={() => toggle(row)}
                      className={cn(
                        "h-10 w-28 shrink-0 rounded-full text-sm font-bold transition-colors disabled:opacity-60",
                        row.available ? "bg-emerald-600 text-white" : "bg-berry text-foam",
                      )}
                    >
                      {pendingKey === id ? "Saving…" : row.available ? "Available" : "Sold out"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
