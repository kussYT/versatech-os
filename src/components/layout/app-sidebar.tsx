"use client";

import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel hidden overflow-hidden rounded-[1.35rem] lg:fixed lg:inset-y-3 lg:left-3 lg:z-20 lg:flex lg:w-64 lg:flex-col">
      <Brand />
      {/* Compte dans le header (UserMenu) — la maquette ne met que Paramètres en bas. */}
      <SidebarNav pathname={pathname} />
    </aside>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-white shadow-[0_2px_8px_rgb(0_122_255/0.35)]"
        aria-hidden="true"
      >
        V
      </span>
      <div className="min-w-0">
        <p className="text-[0.95rem] leading-tight font-semibold tracking-tight text-foreground">
          VersaTech OS
        </p>
        <p className="text-meta leading-tight text-muted">Agence web</p>
      </div>
    </div>
  );
}
