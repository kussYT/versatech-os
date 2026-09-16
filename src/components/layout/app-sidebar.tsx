"use client";

import { usePathname } from "next/navigation";
import { SessionAccount } from "@/components/auth/session-account";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { SessionUser } from "@/lib/auth/types";

type AppSidebarProps = {
  user: SessionUser;
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-20 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-sidebar">
      <Brand />
      <SidebarNav pathname={pathname} account={<SessionAccount user={user} />} />
    </aside>
  );
}

export function Brand() {
  return (
    <div className="flex items-start gap-2.5 px-5 py-5">
      <span className="brand-gem mt-0.5 text-[1.05rem]" aria-hidden="true">
        ✦
      </span>
      <div>
        <p className="brand-wordmark text-sm font-semibold tracking-[0.2em] text-foreground">
          VERSATECH
        </p>
        <p className="font-mono text-[11px] tracking-[0.32em] text-muted">OS</p>
      </div>
    </div>
  );
}
