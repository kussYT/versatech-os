"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Brand } from "@/components/layout/app-sidebar";
import { SessionAccount } from "@/components/auth/session-account";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/types";

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
};

export function MobileNavDrawer({ open, onClose, user }: MobileNavDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (media.matches) {
        onClose();
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="nav-drawer"
      aria-label="Menu de navigation"
      onClose={onClose}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="mt-3 mr-2"
            onClick={onClose}
            aria-label="Fermer la navigation"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <SidebarNav pathname={pathname} account={<SessionAccount user={user} />} />
      </div>
    </dialog>
  );
}
