import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { PremiumCard } from "@/components/ui/premium-card";
import { cn } from "@/lib/cn";

type KpiCardProps = {
  label: string;
  icon?: LucideIcon;
  value?: string;
  hint?: string;
  premium?: boolean;
  className?: string;
};

export function KpiCard({
  label,
  icon,
  value = "—",
  hint = "Aucune donnée disponible",
  premium = false,
  className,
}: KpiCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-meta font-medium tracking-[0.1em] text-muted uppercase">
          {label}
        </p>
        {icon
          ? createElement(icon, {
              className: "size-4 text-muted",
              "aria-hidden": true,
            })
          : null}
      </div>
      <p className="mt-3 font-sans text-kpi text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-meta text-muted">{hint}</p>
    </>
  );

  if (premium) {
    return <PremiumCard className={cn("p-4", className)}>{body}</PremiumCard>;
  }

  return (
    <InteractiveCard className={cn("foil-subtle p-4", className)}>
      {body}
    </InteractiveCard>
  );
}
