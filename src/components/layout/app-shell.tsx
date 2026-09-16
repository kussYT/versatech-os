"use client";

import { useCallback, useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { ProspectComposerProvider } from "@/components/crm/prospect-composer";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <ProspectComposerProvider>
      <div className="app-canvas min-h-full">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <AppSidebar />
      <MobileNavDrawer open={navOpen} onClose={closeNav} />
      <div className="lg:pl-64">
        <AppTopbar onOpenNav={() => setNavOpen(true)} />
        <main
          id="contenu"
          className="px-3 py-5 sm:px-6 sm:py-6 pb-24 lg:pb-8"
        >
          {children}
        </main>
      </div>
      <MobileTabBar onOpenNav={() => setNavOpen(true)} />
      </div>
    </ProspectComposerProvider>
  );
}
