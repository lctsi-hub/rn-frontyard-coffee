import "server-only";

import { cache } from "react";
import { localStoreSettings } from "@/data/store-settings";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public";
import type { StoreSettings } from "@/types/order";

/**
 * Store settings for this request. Ordering on/off and delivery rules come
 * from the database (edited in Admin → Settings); payment methods and GCash
 * come from src/data/store-settings.ts. If the database can't be read, the
 * local defaults are used; create_order() re-checks every rule anyway.
 */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  if (!isSupabaseConfigured()) return localStoreSettings;

  try {
    const supabase = createSupabasePublicServerClient();
    const [settings, areas] = await Promise.all([
      supabase.from("store_settings").select("ordering_enabled, delivery_enabled, delivery_min_order, free_delivery_from").single(),
      supabase.from("delivery_areas").select("id, name, fee, is_active").order("sort_order").order("name"),
    ]);
    if (settings.error || areas.error) throw settings.error ?? areas.error;

    return {
      ...localStoreSettings,
      ordering: { enabled: settings.data.ordering_enabled },
      delivery: {
        enabled: settings.data.delivery_enabled,
        minimumOrder: Number(settings.data.delivery_min_order),
        freeDeliveryFrom: settings.data.free_delivery_from === null ? null : Number(settings.data.free_delivery_from),
        areas: areas.data.map((a) => ({ id: a.id, name: a.name, fee: Number(a.fee), isActive: a.is_active })),
      },
    };
  } catch (error) {
    console.error("[settings] database unavailable, using local defaults", { code: (error as { code?: string })?.code });
    return localStoreSettings;
  }
});
