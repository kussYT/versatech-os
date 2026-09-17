"use client";

import { useCallback, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { UnauthenticatedState } from "@/components/auth/unauthenticated-state";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { ProspectComposerProvider } from "@/components/crm/prospect-composer";
import { isPublicPath } from "@/lib/auth/paths";
import type { SessionUser } from "@/lib/auth/types";

type AppShellProps = {
  children: ReactNode;
  user: SessionUser | null;
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!user) {
    return <UnauthenticatedState />;
  }

  return (
    <ProspectComposerProvider>
      <div className="app-canvas min-h-full">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <AppSidebar user={user} />
      <MobileNavDrawer open={navOpen} onClose={closeNav} user={user} />
      <div className="lg:pl-64">
        <AppTopbar onOpenNav={() => setNavOpen(true)} />
        <main
          id="contenu"
          className="px-3 py-5 sm:px-6 sm:py-6 pb-24 lg:pb-8 [&_button]:scroll-mb-28 [&_a]:scroll-mb-28"
        >
          {children}
        </main>
      </div>
      <MobileTabBar onOpenNav={() => setNavOpen(true)} />
      </div>
    </ProspectComposerProvider>
  );
}
