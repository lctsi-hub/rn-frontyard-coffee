"use client";

import { Plus, Save } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addDeliveryArea,
  setDeliveryEnabled,
  setOrderingEnabled,
  updateDeliveryArea,
  updateDeliveryRules,
  type ActionResult,
} from "@/app/admin/(panel)/settings/actions";
import { formatPeso } from "@/lib/format";
import { cn } from "@/lib/utils";

type Area = { id: string; name: string; fee: number; isActive: boolean };
type Settings = { orderingEnabled: boolean; deliveryEnabled: boolean; minimumOrder: number; freeDeliveryFrom: number | null };

const input = "h-11 w-full rounded-xl bg-cream px-3 ring-1 ring-espresso/10 focus:ring-2 focus:ring-espresso focus:outline-none";

export function SettingsPanel({ settings, areas }: { settings: Settings; areas: Area[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setResult(await action());
    });

  return (
    <div className="flex flex-col gap-5">
      {result && (
        <p role="status" className={cn("rounded-2xl px-4 py-3 text-sm font-semibold", result.ok ? "bg-emerald-100 text-emerald-900" : "bg-berry/10 text-berry")}>
          {result.message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <BigSwitch
          title="Online Ordering"
          description="When off, customers can still browse the menu but can't check out."
          on={settings.orderingEnabled}
          disabled={pending}
          onToggle={() => run(() => setOrderingEnabled(!settings.orderingEnabled))}
        />
        <BigSwitch
          title="Delivery"
          description="When off, Delivery is shown but disabled at checkout."
          on={settings.deliveryEnabled}
          disabled={pending}
          onToggle={() => run(() => setDeliveryEnabled(!settings.deliveryEnabled))}
        />
      </div>

      <DeliveryRules settings={settings} pending={pending} onSave={(values) => run(() => updateDeliveryRules(values))} />

      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-espresso/5">
        <h2 className="font-display text-xl font-semibold">Delivery areas</h2>
        <p className="mt-1 text-sm text-mocha">Fee per barangay. Switch an area off to stop delivering there (past orders keep their details).</p>
        <ul className="mt-4 flex flex-col gap-3">
          {areas.map((area) => (
            <AreaRow key={`${area.id}-${area.name}-${area.fee}-${area.isActive}`} area={area} pending={pending} onSave={(values) => run(() => updateDeliveryArea(values))} />
          ))}
        </ul>
        <AddArea pending={pending} onAdd={(values) => run(() => addDeliveryArea(values))} />
      </section>
    </div>
  );
}

function BigSwitch({ title, description, on, disabled, onToggle }: { title: string; description: string; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <section className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-espresso/5">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className={cn("mt-1 text-lg font-bold", on ? "text-emerald-700" : "text-berry")}>{on ? "🟢 AVAILABLE" : "🔴 UNAVAILABLE"}</p>
        <p className="mt-1 text-sm text-mocha">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${title}: ${on ? "available" : "unavailable"}`}
        disabled={disabled}
        onClick={onToggle}
        className={cn("relative h-10 w-[4.5rem] shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-emerald-600" : "bg-espresso/25")}
      >
        <span className={cn("absolute top-1 size-8 rounded-full bg-white shadow transition-transform", on ? "translate-x-9" : "translate-x-1")} />
      </button>
    </section>
  );
}

function DeliveryRules({
  settings,
  pending,
  onSave,
}: {
  settings: Settings;
  pending: boolean;
  onSave: (values: { minimumOrder: string; freeDeliveryFrom: string; offerFree: boolean }) => void;
}) {
  const [minimumOrder, setMinimumOrder] = useState(String(settings.minimumOrder));
  const [offerFree, setOfferFree] = useState(settings.freeDeliveryFrom !== null);
  const [freeFrom, setFreeFrom] = useState(String(settings.freeDeliveryFrom ?? 500));

  return (
    <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-espresso/5">
      <h2 className="font-display text-xl font-semibold">Delivery rules</h2>
      <p className="mt-1 text-sm text-mocha">
        Now: minimum {formatPeso(settings.minimumOrder)}
        {settings.freeDeliveryFrom !== null ? ` · FREE from ${formatPeso(settings.freeDeliveryFrom)}` : " · no free delivery"}
      </p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ minimumOrder, freeDeliveryFrom: freeFrom, offerFree });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Minimum order for delivery (₱)
          <input className={input} inputMode="decimal" value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1 text-sm font-semibold">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={offerFree} onChange={(e) => setOfferFree(e.target.checked)} className="size-4 accent-espresso" />
            Free delivery from (₱)
          </label>
          <input className={input} inputMode="decimal" value={freeFrom} disabled={!offerFree} onChange={(e) => setFreeFrom(e.target.value)} />
        </div>
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-espresso px-5 font-semibold text-foam disabled:opacity-50">
          <Save className="size-4" /> Save rules
        </button>
      </form>
    </section>
  );
}

function AreaRow({ area, pending, onSave }: { area: Area; pending: boolean; onSave: (values: { id: string; name: string; fee: string; isActive: boolean }) => void }) {
  const [name, setName] = useState(area.name);
  const [fee, setFee] = useState(String(area.fee));
  const [active, setActive] = useState(area.isActive);
  const dirty = name !== area.name || fee !== String(area.fee) || active !== area.isActive;

  return (
    <li className={cn("grid gap-3 rounded-2xl p-3 ring-1 ring-espresso/10 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-center", !active && "bg-cream/60")}>
      <input className={input} value={name} onChange={(e) => setName(e.target.value)} aria-label="Area name" />
      <label className="flex items-center gap-2 text-sm">
        ₱<input className={input} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} aria-label={`${area.name} fee`} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-espresso" />
        {active ? "Active" : "Off"}
      </label>
      <button
        type="button"
        disabled={!dirty || pending}
        onClick={() => onSave({ id: area.id, name, fee, isActive: active })}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-espresso px-4 text-sm font-semibold text-foam disabled:opacity-40"
      >
        <Save className="size-4" /> Save
      </button>
    </li>
  );
}

function AddArea({ pending, onAdd }: { pending: boolean; onAdd: (values: { name: string; fee: string }) => void }) {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("50");
  return (
    <form
      className="mt-4 grid gap-3 rounded-2xl border border-dashed border-espresso/20 p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ name, fee });
        setName("");
      }}
    >
      <input className={input} placeholder="New barangay name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New barangay name" />
      <label className="flex items-center gap-2 text-sm">
        ₱<input className={input} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} aria-label="New area fee" />
      </label>
      <button type="submit" disabled={pending || !name.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-coffee ring-1 ring-espresso/20 disabled:opacity-40">
        <Plus className="size-4" /> Add area
      </button>
    </form>
  );
}
