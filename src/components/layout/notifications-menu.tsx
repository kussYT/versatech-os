"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useDismissibleMenu } from "@/components/layout/use-dismissible-menu";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";

export type NotificationMenuItem = {
  id: string;
  title: string;
  href: string;
  kind: "follow_up" | "action";
  whenLabel: string;
};

type NotificationsMenuProps = {
  items: readonly NotificationMenuItem[];
  className?: string;
};

const KIND_LABELS: Record<NotificationMenuItem["kind"], string> = {
  follow_up: "Relance",
  action: "Action",
};

export function NotificationsMenu({ items, className }: NotificationsMenuProps) {
  const { open, close, toggle, containerRef } = useDismissibleMenu();
  const count = items.length;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "ghost", size: "icon", shape: "pill" }), "relative")}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={count > 0 ? `Notifications (${count})` : "Notifications"}
        onClick={toggle}
      >
        <Bell className="size-4" aria-hidden="true" />
        {count > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white"
            aria-hidden="true"
          >
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          aria-label="Notifications"
          className="glass-panel absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl p-1.5"
        >
          {count === 0 ? (
            <p className="px-3 py-4 text-body text-muted">
              Aucune relance urgente ni action prioritaire.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,70dvh)] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="block rounded-xl px-3 py-2 transition-colors duration-hover hover:bg-primary/10 focus-visible:bg-primary/10"
                  >
                    <span className="block truncate text-body font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="block text-meta text-muted">
                      {KIND_LABELS[item.kind]} · {item.whenLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
