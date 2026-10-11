"use client";

import { useCallback, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { VersatechAiProvider } from "@/components/ai/versatech-ai";
import { VersatechAiPanel } from "@/components/ai/versatech-ai-panel";
import { UnauthenticatedState } from "@/components/auth/unauthenticated-state";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import type { NotificationMenuItem } from "@/components/layout/notifications-menu";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { ProspectComposerProvider } from "@/components/crm/prospect-composer";
import { isPublicPath } from "@/lib/auth/paths";
import type { SessionUser } from "@/lib/auth/types";

type AppShellProps = {
  children: ReactNode;
  user: SessionUser | null;
  notificationItems?: readonly NotificationMenuItem[];
};

export function AppShell({ children, user, notificationItems = [] }: AppShellProps) {
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
      <VersatechAiProvider>
        <div className="app-canvas min-h-full">
          <a className="skip-link" href="#contenu">
            Aller au contenu
          </a>
          <AppSidebar />
          <MobileNavDrawer open={navOpen} onClose={closeNav} user={user} />
          <div className="lg:pl-[17.5rem]">
            <AppTopbar
              onOpenNav={() => setNavOpen(true)}
              user={user}
              notificationItems={notificationItems}
            />
            <main
              id="contenu"
              className="px-3 pt-4 pb-24 sm:px-5 sm:pt-5 lg:px-6 lg:pb-8 [&_button]:scroll-mb-28 [&_a]:scroll-mb-28"
            >
              {children}
            </main>
          </div>
          <MobileTabBar onOpenNav={() => setNavOpen(true)} />
          <VersatechAiPanel />
        </div>
      </VersatechAiProvider>
    </ProspectComposerProvider>
  );
}
