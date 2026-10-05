"use client";

// "+ Add Item" inside the (server-rendered) order history: one shared sheet for
// the page; after an item is added the page re-reads the order from the server.
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import type { PricedExtra } from "@/lib/orders/staff-items";
import type { Menu } from "@/types/menu";
import { useOrderAdditions, type AddTarget } from "./AddItem";

const AddItemContext = createContext<((order: AddTarget) => void) | null>(null);

export function AddItemProvider({ menu, extras, children }: { menu: Menu; extras: PricedExtra[]; children: ReactNode }) {
  const router = useRouter();
  const additions = useOrderAdditions({ menu, extras, onChanged: () => router.refresh() });
  return (
    <AddItemContext value={additions.openAddItem}>
      {children}
      {additions.element}
    </AddItemContext>
  );
}

export function AddItemButton({ order }: { order: AddTarget }) {
  const open = useContext(AddItemContext);
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={() => open(order)}
      className="inline-flex h-11 items-center gap-1 rounded-full bg-espresso px-5 text-sm font-semibold text-foam"
    >
      <Plus className="size-4" /> Add Item
    </button>
  );
}
