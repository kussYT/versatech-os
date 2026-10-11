"use client";

import { LogoutButton } from "@/components/auth/logout-button";
import type { SessionUser } from "@/lib/auth/types";

type SessionAccountProps = {
  user: SessionUser;
};

export function SessionAccount({ user }: SessionAccountProps) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/60 px-3 py-2.5 shadow-[0_1px_2px_rgb(31_41_80/0.05)] backdrop-blur-md">
      <p className="truncate text-meta font-medium text-foreground">{user.name}</p>
      <p className="truncate font-mono text-[11px] text-muted">{user.email}</p>
      <LogoutButton className="mt-2" />
    </div>
  );
}
