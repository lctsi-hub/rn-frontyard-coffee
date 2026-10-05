import type { Metadata } from "next";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [settings, areas] = await Promise.all([
    supabase.from("store_settings").select("ordering_enabled, delivery_enabled, delivery_min_order, free_delivery_from").single(),
    supabase.from("delivery_areas").select("id, name, fee, is_active").order("sort_order").order("name"),
  ]);

  if (settings.error || areas.error) {
    return <p className="rounded-2xl bg-berry/10 p-4 text-berry">Couldn&apos;t load settings. Please refresh.</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-mocha">Changes apply to the customer menu and checkout right away.</p>
      <div className="mt-5">
        <SettingsPanel
          settings={{
            orderingEnabled: settings.data.ordering_enabled,
            deliveryEnabled: settings.data.delivery_enabled,
            minimumOrder: Number(settings.data.delivery_min_order),
            freeDeliveryFrom: settings.data.free_delivery_from === null ? null : Number(settings.data.free_delivery_from),
          }}
          areas={areas.data.map((a) => ({ id: a.id, name: a.name, fee: Number(a.fee), isActive: a.is_active }))}
        />
      </div>
    </div>
  );
}
