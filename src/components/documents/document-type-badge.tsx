import { DOCUMENT_TYPE_LABELS } from "@/lib/crm/constants";
import { cn } from "@/lib/cn";
import type { DocumentType } from "@/generated/prisma/client";

const documentTypeClassName: Record<DocumentType, string> = {
  QUOTE: "border-cyan/30 bg-cyan/10 text-cyan",
  PROPOSAL: "border-purple/30 bg-purple/10 text-purple",
  INVOICE: "border-orange/30 bg-orange/10 text-orange",
  CONTRACT: "border-primary/30 bg-primary/10 text-primary",
  ASSET: "border-success/30 bg-success/10 text-success",
  OTHER: "border-faint/40 bg-surface-high text-muted",
};

type DocumentTypeBadgeProps = {
  type: DocumentType;
  className?: string;
};

export function DocumentTypeBadge({ type, className }: DocumentTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
        documentTypeClassName[type],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {DOCUMENT_TYPE_LABELS[type]}
    </span>
  );
}
