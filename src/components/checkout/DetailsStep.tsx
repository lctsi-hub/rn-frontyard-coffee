"use client";

import { Bell, MapPin } from "lucide-react";
import { Sparkle } from "@/components/brand/Sparkle";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import {
  activeDeliveryAreas,
  amountUntilFreeDelivery,
  areaDeliveryFee,
  deliveryFeeSummary,
  MAX_FIELD_LENGTH,
  qualifiesForFreeDelivery,
  quoteDelivery,
  type CheckoutForm,
  type FieldErrors,
} from "@/lib/checkout";
import { formatPeso } from "@/lib/format";
import { STORE_LOCATION_LABEL } from "@/lib/store";
import { MAX_TABLE_NUMBER } from "@/lib/table";
import type { StoreSettings } from "@/types/order";

const TITLES = { dine_in: "Dine-in details", take_out: "Take-out details", delivery: "Delivery details" } as const;

export function DetailsStep({
  form,
  settings,
  subtotal,
  tableFromLink,
  errors,
  onChange,
}: {
  form: CheckoutForm;
  settings: StoreSettings;
  subtotal: number;
  tableFromLink: number | null;
  errors: FieldErrors;
  onChange: (patch: Partial<CheckoutForm>) => void;
}) {
  const type = form.orderType;
  if (!type) return null;

  const areas = activeDeliveryAreas(settings);
  const quote = quoteDelivery(settings, form.areaId, subtotal);
  const isFree = qualifiesForFreeDelivery(settings, subtotal);
  const untilFree = amountUntilFreeDelivery(settings, subtotal);

  return (
    <section aria-labelledby="details-title">
      <h1 id="details-title" className="font-display text-[1.75rem] leading-tight font-semibold">
        {TITLES[type]}
      </h1>

      <div className="mt-5 flex flex-col gap-5">
        {type === "dine_in" &&
          (tableFromLink ? (
            <div className="relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] bg-espresso p-4 text-foam shadow-lift">
              <Sparkle className="absolute top-3 right-4 size-4 animate-twinkle text-honey" />
              <span className="font-display grid size-14 shrink-0 place-items-center rounded-2xl bg-foam text-2xl font-bold text-espresso">
                {tableFromLink}
              </span>
              <p className="leading-tight">
                <span className="block text-sm text-foam/70">You&apos;re ordering for</span>
                <span className="font-display text-2xl font-semibold">Table {tableFromLink}</span>
              </p>
            </div>
          ) : (
            <TextField
              id="field-tableInput"
              label="Table number"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              placeholder="e.g. 5"
              hint="You'll find it on the QR code at your table."
              value={form.tableInput}
              error={errors.tableInput}
              onChange={(e) => onChange({ tableInput: e.target.value.replace(/\D/g, "").slice(0, String(MAX_TABLE_NUMBER).length) })}
            />
          ))}

        <TextField
          id="field-name"
          label="Your name"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={MAX_FIELD_LENGTH.name}
          placeholder="e.g. Juan"
          value={form.name}
          error={errors.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />

        <TextField
          id="field-phone"
          label="Mobile number"
          optional={type === "dine_in"}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={17}
          placeholder="0917 123 4567"
          hint={type === "dine_in" ? "In case we need to reach you." : "We'll text or call you about your order."}
          value={form.phone}
          error={errors.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
        />

        {type === "take_out" && (
          <p className="flex items-start gap-3 rounded-2xl bg-oat/60 p-4 text-sm text-coffee">
            <Bell className="mt-0.5 size-5 shrink-0 text-caramel" strokeWidth={2} />
            <span>
              <span className="font-semibold">We&apos;ll notify you when your order is ready.</span> No delivery fee
              for take-out.
            </span>
          </p>
        )}

        {type === "delivery" && (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-oat/60 p-4 text-sm text-coffee">
              <MapPin className="mt-0.5 size-5 shrink-0 text-caramel" strokeWidth={2} />
              <div className="space-y-1">
                <p>
                  We deliver around <span className="font-semibold">{STORE_LOCATION_LABEL}</span>.
                </p>
                {isFree ? (
                  <p className="font-semibold text-espresso">Your order gets FREE delivery!</p>
                ) : (
                  <>
                    <p>{deliveryFeeSummary(settings)}.</p>
                    {untilFree !== null && settings.delivery.freeDeliveryFrom !== null && (
                      <p className="font-semibold text-caramel">
                        Add {formatPeso(untilFree)} more for FREE delivery (orders{" "}
                        {formatPeso(settings.delivery.freeDeliveryFrom)} and above).
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <SelectField
              id="field-areaId"
              label="Barangay / area"
              value={form.areaId ?? ""}
              error={errors.areaId}
              onChange={(e) => onChange({ areaId: e.target.value || null })}
              hint={
                quote ? (
                  <span className="font-semibold text-coffee">
                    Delivery fee: {quote.isFree ? "FREE" : formatPeso(quote.fee)}
                  </span>
                ) : undefined
              }
            >
              <option value="" disabled>
                Choose your barangay
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name} · {isFree ? "FREE" : formatPeso(areaDeliveryFee(settings, area))}
                </option>
              ))}
            </SelectField>

            <TextAreaField
              id="field-address"
              label="Complete address"
              autoComplete="street-address"
              maxLength={MAX_FIELD_LENGTH.address}
              placeholder="House no., street, purok / subdivision"
              value={form.address}
              error={errors.address}
              onChange={(e) => onChange({ address: e.target.value })}
            />

            <TextField
              id="field-landmark"
              label="Landmark"
              maxLength={MAX_FIELD_LENGTH.landmark}
              placeholder="e.g. beside the chapel, green gate"
              value={form.landmark}
              error={errors.landmark}
              onChange={(e) => onChange({ landmark: e.target.value })}
            />

            <TextAreaField
              id="field-deliveryInstructions"
              label="Delivery instructions"
              optional
              maxLength={MAX_FIELD_LENGTH.instructions}
              placeholder="e.g. call when you're outside"
              value={form.deliveryInstructions}
              onChange={(e) => onChange({ deliveryInstructions: e.target.value })}
            />
          </>
        )}
      </div>
    </section>
  );
}
