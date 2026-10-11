"use client";

import { LogoutButton } from "@/components/auth/logout-button";
import { useDismissibleMenu } from "@/components/layout/use-dismissible-menu";
import type { SessionUser } from "@/lib/auth/types";
import { cn } from "@/lib/cn";

type UserMenuProps = {
  user: SessionUser;
  className?: string;
};

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function UserMenu({ user, className }: UserMenuProps) {
  const { open, toggle, containerRef } = useDismissibleMenu();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-meta font-semibold text-primary transition-colors duration-hover hover:bg-primary/20"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Compte de ${user.name}`}
        onClick={toggle}
      >
        {userInitials(user.name)}
      </button>
      {open ? (
        <div
          aria-label="Compte"
          className="glass-panel absolute right-0 z-40 mt-2 w-64 rounded-2xl p-2"
        >
          <div className="px-3 py-2">
            <p className="truncate text-body font-medium text-foreground">{user.name}</p>
            <p className="truncate font-mono text-[11px] text-muted">{user.email}</p>
          </div>
          <div className="border-t border-border/60 pt-1">
            <LogoutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
