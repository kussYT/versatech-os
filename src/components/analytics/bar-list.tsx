import { cn } from "@/lib/cn";

export type BarListItem = {
  key: string;
  label: string;
  display: string;
  value: number;
  tone?: "primary" | "cyan" | "purple" | "orange" | "success" | "danger" | "warning";
};

const toneClass: Record<NonNullable<BarListItem["tone"]>, string> = {
  primary: "bg-primary",
  cyan: "bg-cyan",
  purple: "bg-purple",
  orange: "bg-orange",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

type BarListProps = {
  items: BarListItem[];
  emptyLabel: string;
};

export function BarList({ items, emptyLabel }: BarListProps) {
  const max = items.reduce((current, item) => Math.max(current, item.value), 0);

  if (max <= 0) {
    return <p className="text-meta text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const width = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-meta text-muted">{item.label}</span>
              <span className="text-meta tabular-nums text-foreground">{item.display}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className={cn("h-full rounded-full", toneClass[item.tone ?? "primary"])}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
