"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { NavItem } from "@/components/layout/nav-item";
import { cn } from "@/lib/cn";
import { isNavActive, mobileTabItems } from "@/lib/navigation";

type MobileTabBarProps = {
  onOpenNav: () => void;
};

export function MobileTabBar({ onOpenNav }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className="glass-panel fixed inset-x-2 bottom-2 z-40 rounded-2xl px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Navigation mobile"
    >
      <div className="grid grid-cols-5 gap-0.5">
        {mobileTabItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            compact
            active={isNavActive(pathname, item.href)}
          />
        ))}
        <button
          type="button"
          onClick={onOpenNav}
          className={cn(
            "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[10px] font-medium text-muted transition-colors duration-hover hover:text-foreground sm:text-[11px]",
          )}
          aria-label="Ouvrir le menu complet"
          title="Menu"
        >
          <Menu className="size-[1.15rem]" aria-hidden="true" />
          <span className="leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
