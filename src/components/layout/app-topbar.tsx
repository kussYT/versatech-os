"use client";

import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProspectButton } from "@/components/crm/new-prospect-button";

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
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-body text-muted shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors duration-hover hover:border-primary/35 hover:text-foreground focus-visible:border-primary"
          aria-label="Recherche globale"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Rechercher…</span>
          <kbd className="hidden rounded-md border border-border bg-surface-high px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
            Ctrl/Cmd + K
          </kbd>
        </button>
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
