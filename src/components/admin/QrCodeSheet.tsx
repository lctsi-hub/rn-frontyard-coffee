"use client";

import { Download, Printer, TriangleAlert } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { MAX_TABLE_NUMBER } from "@/lib/table";

type Card = { label: string; url: string; svg: string; png: string };

const QR_OPTIONS = { margin: 1, errorCorrectionLevel: "M" as const, color: { dark: "#2a1b12", light: "#ffffff" } };

async function makeCard(label: string, url: string): Promise<Card> {
  const [svg, png] = await Promise.all([
    QRCode.toString(url, { ...QR_OPTIONS, type: "svg" }),
    QRCode.toDataURL(url, { ...QR_OPTIONS, width: 1024 }),
  ]);
  return { label, url, svg, png };
}

export function QrCodeSheet({ defaultBaseUrl }: { defaultBaseUrl: string | null }) {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl ?? "");
  const [tables, setTables] = useState(10);
  const [cards, setCards] = useState<Card[]>([]);

  // Fall back to the address this dashboard is opened on.
  useEffect(() => {
    if (defaultBaseUrl) return;
    const id = window.setTimeout(() => setBaseUrl(window.location.origin), 0);
    return () => window.clearTimeout(id);
  }, [defaultBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    const base = baseUrl.replace(/\/+$/, "");
    if (!/^https?:\/\/[^\s]+$/.test(base)) return;
    const count = Math.min(Math.max(1, Math.floor(tables) || 1), MAX_TABLE_NUMBER);
    Promise.all([
      makeCard("Order online", `${base}/order`),
      ...Array.from({ length: count }, (_, i) => makeCard(`Table ${i + 1}`, `${base}/order?table=${i + 1}`)),
    ]).then((result) => {
      if (!cancelled) setCards(result);
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, tables]);

  const isLocal = /localhost|127\.0\.0\.1|192\.168\.|172\.(1[6-9]|2\d|3[01])\./.test(baseUrl);

  return (
    <div>
      <div className="grid gap-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-espresso/5 print:hidden sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Website address
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value.trim())}
            placeholder="https://your-site.vercel.app"
            className="h-11 rounded-xl bg-cream px-3 font-normal ring-1 ring-espresso/10"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Number of tables
          <input
            type="number"
            min={1}
            max={MAX_TABLE_NUMBER}
            value={tables}
            onChange={(e) => setTables(Number(e.target.value))}
            className="h-11 rounded-xl bg-cream px-3 font-normal ring-1 ring-espresso/10"
          />
        </label>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-espresso px-5 font-semibold text-foam">
          <Printer className="size-4" /> Print all
        </button>
        {isLocal && (
          <p className="flex items-start gap-2 rounded-2xl bg-honey/30 p-3 text-sm sm:col-span-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-caramel" />
            This is a local address. Before printing, enter the shop&apos;s public website address (after the site is
            deployed), or the codes won&apos;t open on customers&apos; phones.
          </p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:mt-0 print:grid-cols-2 print:gap-6">
        {cards.map((card) => (
          <article key={card.url} className="flex break-inside-avoid flex-col items-center rounded-3xl bg-white p-6 text-center shadow-card ring-1 ring-espresso/10 print:shadow-none">
            <Logo className="w-28 text-espresso" />
            <p className="font-display mt-3 text-3xl font-bold">{card.label}</p>
            <div className="mt-3 w-full max-w-56" dangerouslySetInnerHTML={{ __html: card.svg }} />
            <p className="mt-3 font-semibold">Scan to view the menu &amp; order</p>
            <p className="mt-1 text-xs break-all text-mocha">{card.url}</p>
            <div className="mt-4 flex gap-2 print:hidden">
              <a
                href={card.png}
                download={`rn-frontyard-${card.label.toLowerCase().replace(/\s+/g, "-")}.png`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-coffee ring-1 ring-espresso/15"
              >
                <Download className="size-4" /> PNG
              </a>
              <a
                href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(card.svg)}`}
                download={`rn-frontyard-${card.label.toLowerCase().replace(/\s+/g, "-")}.svg`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-coffee ring-1 ring-espresso/15"
              >
                <Download className="size-4" /> SVG
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
