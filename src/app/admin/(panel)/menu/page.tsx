import type { Metadata } from "next";
import { MenuAvailabilityPanel, type MenuGroup } from "@/components/admin/MenuAvailabilityPanel";
import { localMenu } from "@/data/menu-data";
import { requireAdmin } from "@/lib/auth/admin";
import { formatPeso } from "@/lib/format";
import { groupByCategory } from "@/lib/menu";
import { applyAvailability, type AvailabilityRow } from "@/lib/menu-availability";
import { startingPrice } from "@/lib/menu-display";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Menu" };

export default async function AdminMenuPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("menu_availability").select("item_type, item_key, is_available");

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold">Menu availability</h1>
        <p className="mt-4 rounded-2xl bg-honey/30 p-4 text-sm text-espresso">
          Sold-out switches need the database update <code>20261006090000_menu_availability_and_realtime.sql</code>. Apply it in
          the Supabase SQL Editor, then reload this page.
        </p>
      </div>
    );
  }

  const menu = applyAvailability(localMenu, (data ?? []) as AvailabilityRow[]);
  const groups: MenuGroup[] = groupByCategory(menu).map((category) => ({
    title: category.name,
    rows: category.products.map((p) => ({
      type: "product" as const,
      key: p.id,
      name: p.name,
      detail: `${p.sizes.length > 1 ? "from " : ""}${formatPeso(startingPrice(p))}${p.sizes.length ? ` · ${p.sizes.map((s) => s.name).join(" / ")}` : ""}`,
      available: p.isAvailable,
      imageUrl: p.imageUrl,
    })),
  }));
  groups.push({
    title: "Add-ons",
    rows: menu.addons.map((a) => ({ type: "addon" as const, key: a.id, name: a.name, detail: `+${formatPeso(a.price)}`, available: a.isAvailable, imageUrl: null })),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Menu availability</h1>
      <p className="mt-1 text-sm text-mocha">
        Tap to switch an item between Available and Sold out. Customers see the change right away, and sold-out items can&apos;t be ordered.
      </p>
      <div className="mt-5">
        <MenuAvailabilityPanel groups={groups} />
      </div>
    </div>
  );
}
