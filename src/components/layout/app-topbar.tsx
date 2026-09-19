"use client";

import { Bell, Menu } from "lucide-react";
import { VersatechAiOrb } from "@/components/ai/versatech-ai-orb";
import { Button } from "@/components/ui/button";
import { NewProspectButton } from "@/components/crm/new-prospect-button";
import { GlobalSearch } from "@/components/layout/global-search";

type AppTopbarProps = {
  onOpenNav: () => void;
};

export function AppTopbar({ onOpenNav }: AppTopbarProps) {
  return (
    <header className="glass-topbar sticky top-0 z-20 border-b border-border">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenNav}
          aria-label="Ouvrir la navigation"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        <GlobalSearch
          triggerClassName="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-body text-muted shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors duration-hover hover:border-primary/35 hover:text-foreground focus-visible:border-primary"
        />
        <VersatechAiOrb />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden="true" />
        </Button>
        <NewProspectButton className="hidden sm:inline-flex" />
        <NewProspectButton className="sm:hidden" iconOnly />
      </div>
    </header>
  );
}
