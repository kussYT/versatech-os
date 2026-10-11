import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icons";
import { cn } from "@/lib/cn";
import type { NavItemConfig } from "@/lib/navigation";

type NavItemProps = NavItemConfig & {
  active?: boolean;
  compact?: boolean;
};

export function NavItem({
  href,
  label,
  icon,
  active = false,
  compact = false,
}: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center text-body font-medium transition-colors duration-hover",
        compact
          ? "flex-col gap-1 rounded-xl px-2 py-2 text-[11px]"
          : "gap-2.5 rounded-full px-3 py-2",
        active
          ? compact
            ? "text-primary"
            : "nav-active"
          : compact
            ? "text-muted hover:text-foreground"
            : "text-muted hover:bg-black/[0.04] hover:text-foreground",
      )}
    >
      <NavIcon
        name={icon}
        className={cn(
          "size-4 shrink-0 transition-colors duration-hover",
          active ? "text-primary" : "text-muted group-hover:text-foreground",
        )}
      />
      <span className={cn(compact && "leading-none")}>{label}</span>
    </Link>
  );
}
