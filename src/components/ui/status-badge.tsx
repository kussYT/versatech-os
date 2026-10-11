import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge backdrop-blur-sm font-semibold tracking-wide uppercase",
  {
    variants: {
      status: {
        prospect: "border-primary/30 bg-primary/10 text-primary",
        contacted: "border-purple/30 bg-purple/10 text-violet-700",
        interested: "border-warning/30 bg-warning/10 text-amber-700",
        meeting: "border-orange/30 bg-orange/10 text-orange-700",
        quote: "border-cyan/30 bg-cyan/10 text-sky-700",
        won: "border-success/30 bg-success/10 text-emerald-700",
        lost: "border-danger/30 bg-danger/10 text-red-600",
      },
    },
  },
);

const statusLabels = {
  prospect: "Prospect",
  contacted: "Contacté",
  interested: "Intéressé",
  meeting: "RDV",
  quote: "Devis",
  won: "Gagné",
  lost: "Perdu",
} as const;

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  className?: string;
  label?: string;
};

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  if (!status) {
    return null;
  }

  return (
    <span className={cn(statusBadgeVariants({ status }), className)}>
      <span
        className="size-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {label ?? statusLabels[status]}
    </span>
  );
}
