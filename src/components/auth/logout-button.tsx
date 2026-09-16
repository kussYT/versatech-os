"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <form action={logout} className={className}>
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
        <LogOut className="size-3.5" aria-hidden="true" />
        Se déconnecter
      </Button>
    </form>
  );
}
