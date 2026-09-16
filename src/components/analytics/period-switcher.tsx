import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import {
  ANALYTICS_PERIODS,
  ANALYTICS_PERIOD_LABELS,
  type AnalyticsPeriod,
} from "@/lib/dates";

type PeriodSwitcherProps = {
  period: AnalyticsPeriod;
};

export function PeriodSwitcher({ period }: PeriodSwitcherProps) {
  return (
    <nav aria-label="Période" className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
      {ANALYTICS_PERIODS.map((value) => {
        const active = value === period;
        const href = value === "30d" ? "/analytics" : `/analytics?periode=${value}`;

        return (
          <Link
            key={value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "rounded-md px-3",
              active && "bg-surface-high text-foreground hover:bg-surface-high hover:text-foreground",
            )}
          >
            {ANALYTICS_PERIOD_LABELS[value]}
          </Link>
        );
      })}
    </nav>
  );
}
