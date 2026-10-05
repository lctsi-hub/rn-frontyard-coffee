"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, ClipboardList, Coffee, History, QrCode, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Live Orders", icon: ClipboardList },
  { href: "/admin/orders", label: "History", icon: History },
  { href: "/admin/menu", label: "Menu", icon: Coffee },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/qr", label: "QR Codes", icon: QrCode },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              active ? "bg-espresso text-foam" : "bg-white text-coffee ring-1 ring-espresso/10 hover:bg-oat/60",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
