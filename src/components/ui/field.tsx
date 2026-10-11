import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const controlClassName =
  "w-full rounded-xl border border-white/70 bg-white/55 px-3 py-2 text-body text-foreground shadow-[0_1px_2px_rgb(31_41_80/0.04)] backdrop-blur-sm transition-colors duration-hover placeholder:text-muted hover:border-primary/35 hover:bg-white/75 focus-visible:border-primary disabled:opacity-50";

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
