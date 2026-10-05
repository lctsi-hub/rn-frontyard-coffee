"use client";

import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { TextAreaField } from "@/components/ui/Field";
import {
  formatPhMobile,
  MAX_FIELD_LENGTH,
  normalizePhMobile,
  ORDER_TYPE_LABELS,
  type CheckoutForm,
  type DeliveryQuote,
} from "@/lib/checkout";
import { formatPeso } from "@/lib/format";
import { optionLabel, type PricedItem } from "@/lib/pricing";
import { STORE } from "@/lib/store";
import type { CartLine } from "@/stores/cart";
import type { PaymentMethod } from "@/types/order";

export type ReviewEditTarget = "type" | "details" | "payment";

export function ReviewStep({
  form,
  tableNumber,
  delivery,
  freeDeliveryFrom,
  items,
  subtotal,
  total,
  payment,
  onEdit,
  onNotesChange,
}: {
  form: CheckoutForm;
  tableNumber: number | null;
  delivery: DeliveryQuote | null;
  freeDeliveryFrom: number;
  items: Array<{ line: CartLine; priced: PricedItem | null }>;
  subtotal: number;
  total: number;
  payment: PaymentMethod | null;
  onEdit: (target: ReviewEditTarget) => void;
  onNotesChange: (notes: string) => void;
}) {
  const type = form.orderType;
  const phone = normalizePhMobile(form.phone);

  return (
    <section aria-labelledby="review-title">
      <h1 id="review-title" className="font-display text-[1.75rem] leading-tight font-semibold">
        Review your order
      </h1>
      <p className="mt-1 text-sm text-mocha">Please check everything before placing your order.</p>

      <article className="mt-5 overflow-hidden rounded-[1.75rem] bg-foam shadow-card ring-1 ring-espresso/5">
        <header className="flex flex-col items-center border-b border-dashed border-espresso/15 px-5 pt-5 pb-4 text-espresso">
          <Logo className="w-28" />
          <p className="eyebrow mt-2 text-mocha">Order summary</p>
        </header>

        <Block title="Order type" onEdit={() => onEdit("type")}>
          <p className="font-semibold">
            {type ? ORDER_TYPE_LABELS[type] : "—"}
            {type === "dine_in" && tableNumber && <span className="font-normal"> · Table {tableNumber}</span>}
          </p>
        </Block>

        <Block title="Customer" onEdit={() => onEdit("details")}>
          <p className="font-semibold break-words">{form.name.trim()}</p>
          {phone && <p className="text-sm text-coffee tabular-nums">{formatPhMobile(phone)}</p>}
          {type === "delivery" && (
            <div className="mt-2 space-y-0.5 text-sm text-coffee">
              <p className="break-words">{form.address.trim()}</p>
              <p>
                Brgy. {delivery?.area.name}, {STORE.location.municipality}, {STORE.location.province}
              </p>
              <p className="break-words">
                <span className="text-mocha">Landmark:</span> {form.landmark.trim()}
              </p>
              {form.deliveryInstructions.trim() && (
                <p className="break-words">
                  <span className="text-mocha">Instructions:</span> {form.deliveryInstructions.trim()}
                </p>
              )}
            </div>
          )}
        </Block>

        <Block title="Items">
          <ul className="flex flex-col gap-3">
            {items.map(({ line, priced }) =>
              priced ? (
                <li key={line.lineId} className="flex gap-3 text-sm">
                  <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-oat px-1 text-xs font-bold tabular-nums">
                    {line.quantity}×
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">{priced.product.name}</p>
                    {(priced.size || priced.options.length > 0) && (
                      <p className="text-coffee">
                        {[priced.size?.name, ...priced.options.map(optionLabel)].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {priced.addons.map((addon) => (
                      <p key={addon.id} className="text-mocha">
                        + {addon.name}
                      </p>
                    ))}
                    {line.notes && <p className="mt-0.5 break-words text-coffee italic">“{line.notes}”</p>}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatPeso(priced.lineTotal)}</span>
                </li>
              ) : null,
            )}
          </ul>
        </Block>

        <div className="space-y-1.5 border-b border-dashed border-espresso/15 px-5 py-4 text-sm">
          <Row label="Subtotal" value={formatPeso(subtotal)} />
          {type === "delivery" && delivery && (
            <Row
              label={`Delivery fee (${delivery.area.name})`}
              value={
                delivery.isFree ? (
                  <span className="font-semibold text-caramel">
                    <s className="mr-1.5 font-normal text-mocha">{formatPeso(delivery.regularFee)}</s>FREE
                  </span>
                ) : (
                  formatPeso(delivery.fee)
                )
              }
            />
          )}
          {type === "delivery" && delivery?.isFree && (
            <p className="text-xs text-caramel">Free delivery on orders {formatPeso(freeDeliveryFrom)} and above.</p>
          )}
          <div className="flex items-baseline justify-between pt-2">
            <span className="font-semibold">Grand total</span>
            <span className="font-display text-2xl font-semibold tabular-nums">{formatPeso(total)}</span>
          </div>
        </div>

        <Block title="Payment" onEdit={() => onEdit("payment")} last>
          <p className="font-semibold">{payment?.label}</p>
        </Block>
      </article>

      <div className="mt-5">
        <TextAreaField
          id="field-orderNotes"
          label="Special instructions"
          optional
          maxLength={MAX_FIELD_LENGTH.orderNotes}
          placeholder="Anything else we should know about your order?"
          value={form.orderNotes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>
    </section>
  );
}

function Block({ title, onEdit, last, children }: { title: string; onEdit?: () => void; last?: boolean; children: ReactNode }) {
  return (
    <div className={last ? "px-5 py-4" : "border-b border-dashed border-espresso/15 px-5 py-4"}>
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="eyebrow text-mocha">{title}</h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="-my-2 -mr-2 h-10 rounded-full px-3 text-sm font-semibold text-caramel active:bg-oat"
          >
            Change
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-mocha">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
