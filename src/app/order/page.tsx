import type { Metadata } from "next";
import Image from "next/image";
import { CircleAlert, MapPin } from "lucide-react";
import { FloatingCartBar } from "@/components/cart/FloatingCartBar";
import { CategoryNav } from "@/components/menu/CategoryNav";
import { FeaturedRow } from "@/components/menu/FeaturedRow";
import { ProductCard } from "@/components/menu/ProductCard";
import { OrderHeader } from "@/components/order/OrderHeader";
import { RecentOrderBanner } from "@/components/order/RecentOrderBanner";
import { TableBanner } from "@/components/order/TableBanner";
import { getMenu, groupByCategory } from "@/lib/menu";
import { categorySectionId } from "@/lib/menu-display";
import { getStoreSettings } from "@/lib/settings";
import { STORE, STORE_LOCATION_LABEL } from "@/lib/store";
import { parseTableParam } from "@/lib/table";
import bannerImage from "../../../public/menu/banner-drinks.jpg";

export const metadata: Metadata = {
  title: "Menu",
};

export default async function OrderPage({ searchParams }: PageProps<"/order">) {
  const table = parseTableParam((await searchParams).table);
  const [menu, settings] = await Promise.all([getMenu(), getStoreSettings()]);
  const sections = groupByCategory(menu);
  const categorySlugById = Object.fromEntries(menu.categories.map((c) => [c.id, c.slug]));
  const featured = menu.products.filter((p) => p.isFeatured);

  return (
    <div className="min-h-dvh">
      <OrderHeader table={table} />

      <main className="pb-safe mx-auto max-w-md">
        <section className="animate-fade-up px-4 pt-4">
          <p className="eyebrow text-caramel">Our menu</p>
          <h1 className="font-display mt-1 text-[2rem] leading-tight font-semibold text-balance">
            What are you craving today?
          </h1>

          <div className="relative mt-4 overflow-hidden rounded-[1.75rem] shadow-card">
            <Image
              src={bannerImage}
              alt={`Iced drinks in ${STORE.shortName} cups`}
              placeholder="blur"
              loading="eager"
              fetchPriority="high"
              sizes="(max-width: 448px) 100vw, 448px"
              className="aspect-[16/8] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-espresso/85 to-transparent px-4 pt-10 pb-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foam">
                <MapPin className="size-4 shrink-0" strokeWidth={2.25} />
                {STORE_LOCATION_LABEL}
              </p>
            </div>
          </div>

          {!settings.ordering.enabled && (
            <p role="status" className="mt-4 flex items-start gap-3 rounded-2xl bg-honey/30 p-4 text-sm font-medium text-espresso ring-1 ring-honey">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-caramel" />
              Online ordering is currently unavailable. Please visit us again soon.
            </p>
          )}
          <TableBanner table={table} />
          <RecentOrderBanner />
        </section>

        <div className="animate-fade-up [animation-delay:120ms]">
          <FeaturedRow title="Fresh from our kitchen" products={featured} categorySlugById={categorySlugById} />
        </div>

        <div className="mt-6">
          <CategoryNav categories={sections.map(({ slug, name }) => ({ slug, name }))} />

          {sections.map((section) => (
            <section
              key={section.id}
              id={categorySectionId(section.slug)}
              data-category={section.slug}
              aria-labelledby={`${categorySectionId(section.slug)}-heading`}
              className="scroll-mt-[calc(var(--sticky-offset)+0.5rem)] px-4 pt-6"
            >
              <h2 id={`${categorySectionId(section.slug)}-heading`} className="font-display text-2xl font-semibold">
                {section.name}
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {section.products.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} categorySlug={section.slug} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="px-4 pt-10 text-center text-xs leading-relaxed text-mocha">
          <p>All prices are in Philippine pesos (₱).</p>
          <p className="mt-1">
            {STORE.name} · {STORE_LOCATION_LABEL}
          </p>
        </footer>

        <FloatingCartBar table={table} />
      </main>
    </div>
  );
}
