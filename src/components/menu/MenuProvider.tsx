"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { buildMenuIndex, type MenuIndex } from "@/lib/pricing";
import type { Menu } from "@/types/menu";

const MenuContext = createContext<MenuIndex | null>(null);

/** Makes the menu available to client components (product sheet, cart). */
export function MenuProvider({ menu, children }: { menu: Menu; children: ReactNode }) {
  const index = useMemo(() => buildMenuIndex(menu), [menu]);
  return <MenuContext value={index}>{children}</MenuContext>;
}

export function useMenuIndex() {
  const index = useContext(MenuContext);
  if (!index) throw new Error("useMenuIndex must be used inside <MenuProvider>");
  return index;
}
