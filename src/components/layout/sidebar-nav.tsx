import { NavItem } from "@/components/layout/nav-item";
import { cn } from "@/lib/cn";
import {
  isNavActive,
  navSections,
  settingsItem,
  todayItem,
} from "@/lib/navigation";

type SidebarNavProps = {
  pathname: string;
  className?: string;
};

export function SidebarNav({ pathname, className }: SidebarNavProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <nav
        className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4"
        aria-label="Navigation principale"
      >
        <div className="pt-1">
          <NavItem
            {...todayItem}
            active={isNavActive(pathname, todayItem.href)}
          />
        </div>
        {navSections.map((section) => (
          <div key={section.id} className="mt-5">
            <p className="px-2.5 pb-2.5 pt-1 text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={isNavActive(pathname, item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border px-3 py-3">
        <NavItem
          {...settingsItem}
          active={isNavActive(pathname, settingsItem.href)}
        />
      </div>
    </div>
  );
}
