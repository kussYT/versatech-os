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
  shortLabel,
  icon,
  active = false,
  compact = false,
}: NavItemProps) {
  const visibleLabel = compact ? (shortLabel ?? label) : label;

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center text-body font-medium transition-colors duration-hover",
        compact
          ? "min-h-12 flex-col justify-center gap-1 rounded-xl px-1.5 py-2 text-[10px] sm:text-[11px]"
          : "gap-2.5 rounded-full px-3 py-2",
        active
          ? compact
            ? "bg-primary/10 text-primary"
            : "nav-active"
          : compact
            ? "text-muted hover:text-foreground"
            : "text-muted hover:bg-black/[0.04] hover:text-foreground",
      )}
    >
      <NavIcon
        name={icon}
        className={cn(
          "shrink-0 transition-colors duration-hover",
          compact ? "size-[1.15rem]" : "size-4",
          active ? "text-primary" : "text-muted group-hover:text-foreground",
        )}
      />
      <span className={cn(compact && "max-w-full truncate leading-none")}>{visibleLabel}</span>
    </Link>
  );
}
