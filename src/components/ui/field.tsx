import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const controlClassName =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors duration-hover placeholder:text-muted hover:border-primary/35 focus-visible:border-primary disabled:opacity-50";

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-meta font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-meta text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={describedBy} className="text-meta text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
