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
    <nav aria-label="Période" className="flex flex-wrap gap-1 rounded-full border border-white/70 bg-white/50 p-1 backdrop-blur-md">
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
              "rounded-full px-3",
              active && "bg-white/90 text-foreground shadow-[0_1px_3px_rgb(31_41_80/0.1)] hover:bg-white/90 hover:text-foreground",
            )}
          >
            {ANALYTICS_PERIOD_LABELS[value]}
          </Link>
        );
      })}
    </nav>
  );
}
