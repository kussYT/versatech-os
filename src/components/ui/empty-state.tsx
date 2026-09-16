import { createElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  aside?: string;
  asideIcon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  aside,
  asideIcon: AsideIcon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-6 py-5",
        className,
      )}
    >
      <div className="min-w-0">
        {icon
          ? createElement(icon, {
              className: "mb-2 size-4 text-muted",
              "aria-hidden": true,
            })
          : null}
        <p className="text-body font-medium text-muted">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-meta text-muted">{description}</p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
      {AsideIcon || aside ? (
        <div className="hidden shrink-0 flex-col items-end gap-2 text-right sm:flex">
          {AsideIcon
            ? createElement(AsideIcon, {
                className: "size-10 text-muted/20",
                "aria-hidden": true,
              })
            : null}
          {aside ? (
            <p className="max-w-[10rem] text-meta text-muted/80">{aside}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
