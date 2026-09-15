import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
  {
    variants: {
      status: {
        prospect: "border-primary/30 bg-primary/10 text-primary",
        contacted: "border-purple/30 bg-purple/10 text-purple",
        interested: "border-warning/30 bg-warning/10 text-warning",
        meeting: "border-orange/30 bg-orange/10 text-orange",
        quote: "border-cyan/30 bg-cyan/10 text-cyan",
        won: "border-success/30 bg-success/10 text-success",
        lost: "border-danger/30 bg-danger/10 text-danger",
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
