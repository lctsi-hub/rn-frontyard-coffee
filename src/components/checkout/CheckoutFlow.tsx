"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft, ShoppingBag, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMenuIndex } from "@/components/menu/MenuProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useHydrated } from "@/hooks/useHydrated";
import {
  activeDeliveryAreas,
  formatPhMobile,
  normalizePhMobile,
  orderTypeBlockReason,
  paymentMethodsFor,
  quoteDelivery,
  resolveTable,
  validateDetails,
  validatePayment,
  type CheckoutForm,
  type FieldErrors,
} from "@/lib/checkout";
import { formatPeso } from "@/lib/format";
import { summarizeCart } from "@/lib/pricing";
import { withTable } from "@/lib/table";
import { cn } from "@/lib/utils";
import { submitOrder, type SubmitOrderResult } from "@/services/orders/submit-order";
import { useCart } from "@/stores/cart";
import { updateCheckoutForm, useCheckoutForm } from "@/stores/checkout";
import type { OrderRequest, StoreSettings } from "@/types/order";
import { DetailsStep } from "./DetailsStep";
import { OrderTypeStep } from "./OrderTypeStep";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";

const STEPS = [
  { id: "type", label: "Type" },
  { id: "details", label: "Details" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function stepIndexOf(id: string | null) {
  const index = STEPS.findIndex((s) => s.id === id);
  return index === -1 ? 0 : index;
}

function stepUrl(step: StepId, table: number | null) {
  const params = new URLSearchParams();
  if (table) params.set("table", String(table));
  if (step !== "type") params.set("step", step);
  const query = params.toString();
  return `/order/checkout${query ? `?${query}` : ""}`;
}

function focusFirstError(errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  const el = document.getElementById(`field-${first}`);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.focus({ preventScroll: true });
  }
}

export function CheckoutFlow({ settings, tableFromLink }: { settings: StoreSettings; tableFromLink: number | null }) {
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const cart = useCart();
  const index = useMenuIndex();
  const saved = useCheckoutForm();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitOrderResult | null>(null);
  const attemptRef = useRef<{ key: string; payload: string } | null>(null);

  const summary = summarizeCart(index, cart.lines);

  // Clean saved choices against today's settings and cart (e.g. delivery switched
  // off, or items removed so the order is now below the delivery minimum).
  const storedType =
    saved.orderType && !orderTypeBlockReason(settings, saved.orderType, summary.subtotal) ? saved.orderType : null;
  const orderType = storedType ?? (tableFromLink ? "dine_in" : null);
  const methods = paymentMethodsFor(settings, orderType);
  const form: CheckoutForm = {
    ...saved,
    orderType,
    paymentMethod: methods.some((m) => m.id === saved.paymentMethod) ? saved.paymentMethod : null,
    areaId: activeDeliveryAreas(settings).some((a) => a.id === saved.areaId) ? saved.areaId : null,
  };

  const delivery = orderType === "delivery" ? quoteDelivery(settings, form.areaId, summary.subtotal) : null;
  const deliveryFee = delivery?.fee ?? 0;
  const total = summary.subtotal + deliveryFee;
  const tableNumber = orderType === "dine_in" ? resolveTable(form, tableFromLink) : null;

  // Furthest step the customer may be on, given what's filled in.
  const detailsOk = Object.keys(validateDetails(form, settings, tableFromLink, summary.subtotal)).length === 0;
  const paymentOk = Object.keys(validatePayment(form, settings)).length === 0;
  const maxStep = !orderType ? 0 : !detailsOk ? 1 : !paymentOk ? 2 : 3;
  const stepIndex = Math.min(stepIndexOf(searchParams.get("step")), maxStep);
  const step = STEPS[stepIndex].id;

  // Keep the URL honest if someone opens ?step=review with missing details.
  useEffect(() => {
    if (!hydrated) return;
    const requested = searchParams.get("step") ?? "type";
    if (requested !== step) window.history.replaceState(null, "", stepUrl(step, tableFromLink));
  }, [hydrated, searchParams, step, tableFromLink]);

  function goTo(next: StepId) {
    setErrors({});
    window.history.pushState(null, "", stepUrl(next, tableFromLink));
    window.scrollTo({ top: 0 });
  }

  function change(patch: Partial<CheckoutForm>) {
    updateCheckoutForm(patch);
    const cleared = Object.keys(patch);
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !cleared.includes(key))));
  }

  function fail(found: FieldErrors) {
    setErrors(found);
    requestAnimationFrame(() => focusFirstError(found));
  }

  function next() {
    if (step === "type") {
      if (!orderType) return fail({ orderType: "Please choose Dine In, Take Out or Delivery." });
      updateCheckoutForm({ orderType });
      return goTo("details");
    }
    if (step === "details") {
      const found = validateDetails(form, settings, tableFromLink, summary.subtotal);
      if (Object.keys(found).length) return fail(found);
      const phone = normalizePhMobile(form.phone);
      if (phone) updateCheckoutForm({ phone: formatPhMobile(phone) });
      return goTo("payment");
    }
    if (step === "payment") {
      const found = validatePayment(form, settings);
      if (Object.keys(found).length) return fail(found);
      return goTo("review");
    }
    setResult(null);
    setConfirming(true);
  }

  async function placeOrder() {
    if (!orderType || !form.paymentMethod) return;
    const order: Omit<OrderRequest, "clientRequestId"> = {
      expectedTotal: total,
      orderType,
      tableNumber,
      customer: { name: form.name.trim(), phone: normalizePhMobile(form.phone) },
      delivery:
        orderType === "delivery" && form.areaId
          ? {
              areaId: form.areaId,
              address: form.address.trim(),
              landmark: form.landmark.trim(),
              instructions: form.deliveryInstructions.trim(),
            }
          : null,
      paymentMethod: form.paymentMethod,
      notes: form.orderNotes.trim(),
      items: cart.lines.map(({ productId, sizeId, optionIds, addonIds, quantity, notes }) => ({
        productId,
        sizeId,
        optionIds,
        addonIds,
        quantity,
        notes,
      })),
    };
    // Idempotency key for this checkout attempt: reused only when the exact same
    // order is retried (e.g. after a timeout), replaced as soon as anything changes.
    const payload = JSON.stringify(order);
    if (attemptRef.current?.payload !== payload) {
      attemptRef.current = { key: crypto.randomUUID(), payload };
    }
    const request: OrderRequest = { clientRequestId: attemptRef.current.key, ...order };
    setSubmitting(true);
    try {
      setResult(await submitOrder(request));
    } finally {
      setSubmitting(false);
      setConfirming(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const backHref = stepIndex === 0 ? withTable("/order/cart", tableFromLink) : null;
  const header = (
    <header className="sticky top-0 z-30 bg-cream/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-(--header-h) max-w-md items-center justify-between gap-2 px-3">
        {backHref ? (
          <Link href={backHref} aria-label="Back to cart" className={backClass}>
            <ChevronLeft className="size-5 shrink-0" strokeWidth={2.5} />
            <span className="font-display text-xl font-semibold">Checkout</span>
          </Link>
        ) : (
          <button type="button" onClick={() => goTo(STEPS[stepIndex - 1].id)} aria-label="Previous step" className={backClass}>
            <ChevronLeft className="size-5 shrink-0" strokeWidth={2.5} />
            <span className="font-display text-xl font-semibold">Checkout</span>
          </button>
        )}
        {tableFromLink ? (
          <span className="shrink-0 rounded-full bg-espresso px-3.5 py-1.5 text-sm font-semibold text-foam">
            Table {tableFromLink}
          </span>
        ) : (
          <span className="eyebrow shrink-0 text-mocha">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
        )}
      </div>
    </header>
  );

  if (!hydrated) {
    return (
      <>
        {header}
        <main aria-busy="true" className="mx-auto max-w-md px-4 pt-4">
          <div className="h-2 animate-pulse rounded-full bg-oat" />
          <div className="mt-6 h-8 w-3/4 animate-pulse rounded-full bg-oat" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-4 h-24 animate-pulse rounded-[1.75rem] bg-foam/70" />
          ))}
        </main>
      </>
    );
  }

  if (!settings.ordering.enabled) {
    return (
      <>
        {header}
        <Notice
          title="We're not taking online orders right now"
          body="Please order at the counter, or check back a little later."
          href={withTable("/order", tableFromLink)}
          action="Back to menu"
        />
      </>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <>
        {header}
        <Notice
          title="Your cart is empty"
          body="Add something from the menu first."
          href={withTable("/order", tableFromLink)}
          action="Browse the menu"
        />
      </>
    );
  }

  if (summary.hasProblems) {
    return (
      <>
        {header}
        <Notice
          title="Some items need your attention"
          body="One or more items in your cart are no longer available. Please update your cart to continue."
          href={withTable("/order/cart", tableFromLink)}
          action="Go to cart"
        />
      </>
    );
  }

  const primaryLabel = { type: "Continue", details: "Continue to payment", payment: "Review order", review: "Place Order" }[step];

  return (
    <>
      {header}
      <main className="mx-auto max-w-md px-4 pt-3">
        <StepProgress current={stepIndex} />

        {result && !result.ok && (
          <div role="alert" className="mt-5 flex animate-fade-up gap-3 rounded-[1.75rem] bg-honey/30 p-4 text-sm text-espresso ring-1 ring-honey">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-caramel" />
            <div>
              <p className="font-semibold">Test mode: order not sent</p>
              <p className="mt-1 text-coffee">{result.message} Your cart is still saved.</p>
            </div>
          </div>
        )}

        <div key={step} className="mt-6 animate-fade-up">
          {step === "type" && (
            <OrderTypeStep
              value={orderType}
              settings={settings}
              subtotal={summary.subtotal}
              tableFromLink={tableFromLink}
              error={errors.orderType}
              onChange={(type) => change({ orderType: type })}
            />
          )}
          {step === "details" && (
            <DetailsStep
              form={form}
              settings={settings}
              subtotal={summary.subtotal}
              tableFromLink={tableFromLink}
              errors={errors}
              onChange={change}
            />
          )}
          {step === "payment" && (
            <PaymentStep
              methods={methods}
              orderType={orderType}
              value={form.paymentMethod}
              settings={settings}
              total={total}
              error={errors.paymentMethod}
              onChange={(method) => change({ paymentMethod: method })}
            />
          )}
          {step === "review" && (
            <ReviewStep
              form={form}
              tableNumber={tableNumber}
              delivery={delivery}
              freeDeliveryFrom={settings.delivery.freeDeliveryFrom}
              items={summary.items}
              subtotal={summary.subtotal}
              total={total}
              payment={methods.find((m) => m.id === form.paymentMethod) ?? null}
              onEdit={goTo}
              onNotesChange={(orderNotes) => change({ orderNotes })}
            />
          )}
        </div>

        <div aria-hidden="true" className="h-40" />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-espresso/10 bg-cream/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto max-w-md">
          <p className="mb-2 flex items-baseline justify-between px-1 text-sm">
            <span className="text-mocha">
              {delivery ? (delivery.isFree ? "Total · FREE delivery" : `Total incl. ${formatPeso(deliveryFee)} delivery`) : "Total"}
              {" · "}
              {summary.itemCount} {summary.itemCount === 1 ? "item" : "items"}
            </span>
            <span key={total} className="animate-pop font-semibold tabular-nums">
              {formatPeso(total)}
            </span>
          </p>
          <button
            type="button"
            onClick={next}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2 rounded-full bg-espresso px-6 font-semibold text-foam shadow-lift transition-transform duration-150 active:scale-[0.98]",
            )}
          >
            {primaryLabel}
            {step !== "review" && <ArrowRight className="size-5 shrink-0" strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Place your order?"
        confirmLabel="Yes, place order"
        busy={submitting}
        onConfirm={placeOrder}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <span className="font-semibold text-espresso tabular-nums">{formatPeso(total)}</span> total
          {form.paymentMethod && <> · {methods.find((m) => m.id === form.paymentMethod)?.label}</>}
        </p>
        <p className="mt-1 text-sm">Once placed, the shop will start preparing it.</p>
      </ConfirmDialog>
    </>
  );
}

const backClass =
  "flex h-11 min-w-0 items-center gap-0.5 rounded-full pr-3 pl-1 text-espresso transition-colors active:bg-oat";

function StepProgress({ current }: { current: number }) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((step, i) => (
          <li key={step.id} aria-current={i === current ? "step" : undefined}>
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors duration-300",
                i <= current ? "bg-espresso" : "bg-oat",
              )}
            />
            <span
              className={cn(
                "mt-1.5 block truncate text-[0.6875rem] font-semibold tracking-wide uppercase",
                i === current ? "text-espresso" : "text-mocha/70",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Notice({ title, body, href, action }: { title: string; body: string; href: string; action: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 pt-16 text-center">
      <span className="grid size-24 animate-fade-up place-items-center rounded-full bg-oat text-coffee">
        <ShoppingBag className="size-10" strokeWidth={1.75} />
      </span>
      <h1 className="font-display mt-6 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-mocha">{body}</p>
      <Link
        href={href}
        className="mt-8 flex h-14 items-center gap-2 rounded-full bg-espresso px-7 font-semibold text-foam shadow-lift transition-transform active:scale-[0.97]"
      >
        {action} <ArrowRight className="size-4" strokeWidth={2.5} />
      </Link>
    </main>
  );
}
