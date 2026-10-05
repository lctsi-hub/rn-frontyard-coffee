"use client";

import Image from "next/image";
import { Banknote, Check, Download, Info, Smartphone, Store, type LucideIcon } from "lucide-react";
import { formatPeso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderType, PaymentMethod, PaymentMethodId, StoreSettings } from "@/types/order";

const ICONS: Record<PaymentMethodId, LucideIcon> = { cash: Banknote, gcash: Smartphone, counter: Store };

function describe(method: PaymentMethod, orderType: OrderType | null) {
  if (method.id === "cash" && orderType === "delivery") return "Cash on delivery. Please prepare the exact amount if you can.";
  return method.description;
}

export function PaymentStep({
  methods,
  orderType,
  value,
  settings,
  total,
  error,
  onChange,
}: {
  methods: PaymentMethod[];
  orderType: OrderType | null;
  value: PaymentMethodId | null;
  settings: StoreSettings;
  total: number;
  error?: string;
  onChange: (method: PaymentMethodId) => void;
}) {
  return (
    <section aria-labelledby="payment-title">
      <h1 id="payment-title" className="font-display text-[1.75rem] leading-tight font-semibold">
        How will you pay?
      </h1>

      <div
        id="field-paymentMethod"
        role="radiogroup"
        aria-labelledby="payment-title"
        className={cn("mt-5 flex flex-col gap-3", error && "animate-shake")}
      >
        {methods.map((method) => {
          const Icon = ICONS[method.id];
          const selected = value === method.id;
          return (
            <label
              key={method.id}
              className={cn(
                "flex min-h-20 cursor-pointer items-center gap-4 rounded-[1.75rem] p-4 ring-1 transition-[background-color,color,transform] duration-200 active:scale-[0.98] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-caramel",
                selected ? "bg-espresso text-foam shadow-lift ring-espresso" : "bg-foam shadow-card ring-espresso/5",
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.id}
                checked={selected}
                onChange={() => onChange(method.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-2xl",
                  selected ? "bg-foam/15 text-honey" : "bg-oat text-coffee",
                )}
              >
                <Icon className="size-6" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{method.label}</span>
                <span className={cn("block text-sm", selected ? "text-foam/75" : "text-mocha")}>
                  {describe(method, orderType)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full ring-2",
                  selected ? "bg-honey text-espresso ring-honey" : "ring-espresso/20",
                )}
              >
                {selected && <Check className="size-4" strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-berry">
          {error}
        </p>
      )}

      {value === "gcash" && <GcashDetails gcash={settings.gcash} total={total} />}
    </section>
  );
}


function GcashDetails({ gcash, total }: { gcash: StoreSettings["gcash"]; total: number }) {
  const hasDetails = Boolean(gcash.qrImageUrl || gcash.accountNumber);

  return (
    <div className="mt-4 animate-fade-up rounded-[1.75rem] bg-foam p-5 shadow-card ring-1 ring-espresso/5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow text-caramel">GCash payment</p>
        <p className="text-sm">
          <span className="text-mocha">Amount: </span>
          <span className="font-semibold tabular-nums">{formatPeso(total)}</span>
        </p>
      </div>

      {hasDetails ? (
        <>
          {gcash.qrImageUrl && (
            <>
              <div className="mx-auto mt-4 w-full max-w-60 rounded-2xl bg-white p-3 ring-1 ring-espresso/10">
                <Image
                  src={gcash.qrImageUrl}
                  alt="RN Frontyard Coffee GCash / InstaPay QR code"
                  width={648}
                  height={632}
                  unoptimized
                  className="h-auto w-full [image-rendering:pixelated]"
                />
              </div>
              <a
                href={gcash.qrImageUrl}
                download="rn-frontyard-coffee-gcash-qr.png"
                className="mx-auto mt-3 flex h-11 w-fit items-center gap-2 rounded-full bg-oat px-4 text-sm font-semibold text-coffee active:bg-latte/60"
              >
                <Download className="size-4" strokeWidth={2.25} /> Save QR image
              </a>
            </>
          )}
          {gcash.accountNumber && (
            <dl className="mt-4 space-y-1 text-sm">
              {gcash.accountName && (
                <div className="flex justify-between gap-3">
                  <dt className="text-mocha">Account name</dt>
                  <dd className="font-semibold">{gcash.accountName}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-mocha">GCash number</dt>
                <dd className="font-semibold tabular-nums">{gcash.accountNumber}</dd>
              </div>
            </dl>
          )}
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-coffee">
            {gcash.qrImageUrl && <li>Save the QR image, then in GCash tap “Pay QR” and upload it from your gallery.</li>}
            <li>
              Pay exactly <span className="font-semibold">{formatPeso(total)}</span>.
            </li>
            <li>Show your GCash receipt to our staff or rider.</li>
          </ol>
        </>
      ) : (
        <p className="mt-2 flex items-start gap-2 text-sm text-coffee">
          <Info className="mt-0.5 size-4 shrink-0 text-caramel" />
          We&apos;ll send you our GCash details when we confirm your order. Please wait for our confirmation before
          paying.
        </p>
      )}
    </div>
  );
}
