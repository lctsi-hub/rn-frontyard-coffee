import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ArtKind = "hot" | "iced" | "milk" | "matcha" | "fizz" | "frappe" | "meal" | "snack";

const ART_BY_CATEGORY: Record<string, ArtKind> = {
  coffee: "iced",
  frappe: "frappe",
  "non-coffee": "milk",
  matcha: "matcha",
  "fruit-fizz": "fizz",
  snacks: "snack",
  "rice-meals": "meal",
};

const BACKGROUNDS: Record<ArtKind, string> = {
  hot: "from-oat to-latte/70",
  iced: "from-[#efe6d6] to-[#cdbb9d]",
  milk: "from-[#f3e3dc] to-[#dcbcab]",
  matcha: "from-[#e9ead2] to-[#b9c08f]",
  fizz: "from-[#f6e2df] to-[#e3a99f]",
  frappe: "from-[#efe2d0] to-[#c9a98a]",
  meal: "from-[#ece2cf] to-[#c8b48f]",
  snack: "from-[#f3e6cc] to-[#dcb578]",
};

const ICONS: Record<ArtKind, ReactNode> = {
  hot: (
    <>
      <path d="M17 15c-1.5-2 1.5-3 0-5M22 15c-1.5-2 1.5-3 0-5M27 15c-1.5-2 1.5-3 0-5" />
      <path d="M11 20h22v8a11 11 0 0 1-11 11 11 11 0 0 1-11-11z" />
      <path d="M33 23h2.5a4.5 4.5 0 0 1 0 9H32" />
      <path d="M8 43h28" />
    </>
  ),
  iced: (
    <>
      <path d="M14 12h20l-2.5 28a3 3 0 0 1-3 2.7h-9a3 3 0 0 1-3-2.7z" />
      <path d="M15 20h18" />
      <rect x="18" y="24" width="6" height="6" rx="1.5" />
      <rect x="24" y="31" width="6" height="6" rx="1.5" />
      <path d="M27 12l4-7" />
    </>
  ),
  milk: (
    <>
      <path d="M15 10h18l-2 30a3 3 0 0 1-3 2.8h-8a3 3 0 0 1-3-2.8z" />
      <path d="M16 22c3 2 5-2 8 0s5 2 8 0" />
    </>
  ),
  frappe: (
    <>
      <path d="M14 21h20l-2.6 19a3 3 0 0 1-3 2.6h-8.8a3 3 0 0 1-3-2.6z" />
      <path d="M12 21a12 9 0 0 1 24 0z" />
      <path d="M26 12l3-8" />
    </>
  ),
  matcha: (
    <>
      <path d="M15 10h18l-2 30a3 3 0 0 1-3 2.8h-8a3 3 0 0 1-3-2.8z" />
      <path d="M19 30c2-6 8-8 11-8 0 4-2 9-8 10-1.5.3-3-.4-3-2z" />
      <path d="M19 32l5-5" />
    </>
  ),
  fizz: (
    <>
      <path d="M15 12h18l-2.5 28a3 3 0 0 1-3 2.7h-7a3 3 0 0 1-3-2.7z" />
      <circle cx="21" cy="30" r="1.6" />
      <circle cx="26" cy="24" r="1.6" />
      <circle cx="23" cy="36" r="1.2" />
      <path d="M27 12l5-8" />
    </>
  ),
  meal: (
    <>
      <path d="M7 25h34a17 17 0 0 1-34 0z" />
      <path d="M17 42h14" />
      <path d="M30 6l-7 14M36 8l-9 13" />
    </>
  ),
  snack: (
    <>
      <path d="M13 22h22l-3 20H16z" />
      <path d="M17 22l-1-12M21 22V8M25 22l1-13M29 22l2-11" />
    </>
  ),
};

/**
 * Product photo, or a warm illustrated placeholder until the admin uploads one.
 * `sizes` should match how wide the image renders so phones download a small file.
 */
export function ProductArt({
  imageUrl,
  name,
  categorySlug,
  sizes,
  soldOut = false,
  className,
}: {
  imageUrl: string | null;
  name: string;
  categorySlug: string;
  sizes: string;
  soldOut?: boolean;
  className?: string;
}) {
  const kind = ART_BY_CATEGORY[categorySlug] ?? "hot";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-linear-to-br",
        BACKGROUNDS[kind],
        soldOut && "grayscale-[0.7] opacity-60",
        className,
      )}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill sizes={sizes} className="object-cover" />
      ) : (
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className="absolute inset-0 m-auto h-1/2 w-1/2 text-espresso/55"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONS[kind]}
        </svg>
      )}
    </div>
  );
}
