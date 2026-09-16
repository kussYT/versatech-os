import { PAYMENT_STATUS_LABELS } from "@/lib/crm/constants";
import { cn } from "@/lib/cn";
import type { PaymentStatus } from "@/generated/prisma/client";

const paymentStatusClassName: Record<PaymentStatus, string> = {
  PENDING: "border-cyan/30 bg-cyan/10 text-cyan",
  PAID: "border-success/30 bg-success/10 text-success",
  OVERDUE: "border-danger/30 bg-danger/10 text-danger",
  CANCELED: "border-faint/40 bg-surface-high text-faint",
};

type PaymentStatusBadgeProps = {
  status: PaymentStatus;
  className?: string;
};

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
        paymentStatusClassName[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
