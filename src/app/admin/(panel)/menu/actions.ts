"use server";

import { refresh } from "next/cache";
import { localMenu } from "@/data/menu-data";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AvailabilityResult = { ok: boolean; message: string };

/** Mark a product or add-on Available / Sold out. Only items on the menu are accepted. */
export async function setAvailability(input: { itemType: unknown; itemKey: unknown; available: unknown }): Promise<AvailabilityResult> {
  await requireAdmin();
  const itemType = input.itemType === "addon" ? "addon" : input.itemType === "product" ? "product" : null;
  const itemKey = String(input.itemKey ?? "");
  const exists =
    itemType === "product"
      ? localMenu.products.some((p) => p.id === itemKey)
      : itemType === "addon"
        ? localMenu.addons.some((a) => a.id === itemKey)
        : false;
  if (!itemType || !exists) return { ok: false, message: "Unknown menu item." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("menu_availability")
    .upsert({ item_type: itemType, item_key: itemKey, is_available: Boolean(input.available) }, { onConflict: "item_type,item_key" });
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  refresh();
  return { ok: true, message: input.available ? "Marked available." : "Marked sold out." };
}
