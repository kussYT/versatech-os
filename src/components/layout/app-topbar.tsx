"use client";

import { Menu } from "lucide-react";
import { VersatechAiOrb } from "@/components/ai/versatech-ai-orb";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/layout/global-search";
import {
  NotificationsMenu,
  type NotificationMenuItem,
} from "@/components/layout/notifications-menu";
import { QuickCreateMenu } from "@/components/layout/quick-create-menu";
import { UserMenu } from "@/components/layout/user-menu";
import type { SessionUser } from "@/lib/auth/types";

type AppTopbarProps = {
  onOpenNav: () => void;
  user: SessionUser;
  notificationItems?: readonly NotificationMenuItem[];
};

export function AppTopbar({ onOpenNav, user, notificationItems = [] }: AppTopbarProps) {
  return (
    <div className="sticky top-0 z-20 px-3 pt-3 sm:px-5 lg:px-6 lg:pt-3.5">
      <header className="glass-topbar">
        <div className="flex h-12 items-center gap-2 px-2.5 sm:h-[3.25rem] sm:gap-2.5 sm:px-3.5">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={onOpenNav}
            aria-label="Ouvrir la navigation"
          >
            <Menu className="size-4" aria-hidden="true" />
          </Button>
          <GlobalSearch
            triggerClassName="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/70 bg-white/45 px-3.5 py-1.5 text-left text-body text-muted transition-colors duration-hover hover:border-primary/30 hover:bg-white/70 hover:text-foreground focus-visible:border-primary sm:min-h-10 sm:px-4"
          />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <QuickCreateMenu />
            <NotificationsMenu items={notificationItems} />
            <UserMenu user={user} />
            <VersatechAiOrb />
          </div>
        </div>
      </header>
    </div>
  );
}
