"use client";

import { LogoutButton } from "@/components/auth/logout-button";
import type { SessionUser } from "@/lib/auth/types";

type SessionAccountProps = {
  user: SessionUser;
};

export function SessionAccount({ user }: SessionAccountProps) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
      <p className="truncate text-meta font-medium text-foreground">{user.name}</p>
      <p className="truncate font-mono text-[11px] text-muted">{user.email}</p>
      <LogoutButton className="mt-2" />
    </div>
  );
}
