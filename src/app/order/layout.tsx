import { MenuProvider } from "@/components/menu/MenuProvider";
import { ProductSheetProvider } from "@/components/menu/ProductSheet";
import { getMenu } from "@/lib/menu";

// Shared by the menu and cart pages, so the product sheet and menu data stay
// mounted while the customer moves between them.
export default async function OrderLayout({ children }: LayoutProps<"/order">) {
  const menu = await getMenu();

  return (
    <MenuProvider menu={menu}>
      <ProductSheetProvider>{children}</ProductSheetProvider>
    </MenuProvider>
  );
}
