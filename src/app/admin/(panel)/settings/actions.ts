"use server";

// Store settings changes. Every action re-checks staff access, validates input,
// and writes with the admin's own session, so Row Level Security still applies.
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SettingsUpdate = Database["public"]["Tables"]["store_settings"]["Update"];

export type ActionResult = { ok: boolean; message: string };

const MAX_PESOS = 100_000;
const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

function pesos(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(n) && n >= 0 && n <= MAX_PESOS && Math.round(n * 100) === n * 100 ? n : null;
}

async function updateSettings(patch: SettingsUpdate, success: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("store_settings").update(patch).eq("id", true).select("id");
  if (error || !data?.length) return fail("Couldn't save. Please try again.");
  refresh();
  return ok(success);
}

export async function setOrderingEnabled(enabled: boolean) {
  return updateSettings({ ordering_enabled: Boolean(enabled) }, enabled ? "Online ordering is ON." : "Online ordering is OFF.");
}

export async function setDeliveryEnabled(enabled: boolean) {
  return updateSettings({ delivery_enabled: Boolean(enabled) }, enabled ? "Delivery is AVAILABLE." : "Delivery is UNAVAILABLE.");
}

export async function updateDeliveryRules(input: { minimumOrder: unknown; freeDeliveryFrom: unknown; offerFree: unknown }) {
  const minimum = pesos(input.minimumOrder);
  if (minimum === null) return fail("Minimum order must be a peso amount (0 or more).");
  let free: number | null = null;
  if (input.offerFree) {
    free = pesos(input.freeDeliveryFrom);
    if (free === null) return fail("Free delivery amount must be a peso amount.");
  }
  return updateSettings({ delivery_min_order: minimum, free_delivery_from: free }, "Delivery rules saved.");
}

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function updateDeliveryArea(input: { id: unknown; name: unknown; fee: unknown; isActive: unknown }) {
  await requireAdmin();
  const id = String(input.id ?? "");
  const name = String(input.name ?? "").trim();
  const fee = pesos(input.fee);
  if (!/^[a-z0-9-]+$/.test(id)) return fail("Unknown area.");
  if (name.length < 1 || name.length > 60) return fail("Area name must be 1–60 characters.");
  if (fee === null) return fail("Fee must be a peso amount (0 or more).");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("delivery_areas")
    .update({ name, fee, is_active: Boolean(input.isActive) })
    .eq("id", id)
    .select("id");
  if (error) return fail(error.code === "23505" ? "Another area already has that name." : "Couldn't save the area.");
  if (!data?.length) return fail("Couldn't save the area.");
  refresh();
  return ok(`${name} saved.`);
}

export async function addDeliveryArea(input: { name: unknown; fee: unknown }) {
  await requireAdmin();
  const name = String(input.name ?? "").trim();
  const fee = pesos(input.fee);
  const id = slug(name);
  if (name.length < 1 || name.length > 60 || !id) return fail("Please enter the barangay name.");
  if (fee === null) return fail("Fee must be a peso amount (0 or more).");

  const supabase = await createSupabaseServerClient();
  const { data: last } = await supabase.from("delivery_areas").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase
    .from("delivery_areas")
    .insert({ id, name, fee, is_active: true, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  if (error) return fail(error.code === "23505" ? "That barangay is already on the list." : "Couldn't add the area.");
  refresh();
  return ok(`${name} added.`);
}
