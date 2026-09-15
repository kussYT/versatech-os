import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <section
      className={cn("rounded-card card-sheen border border-border bg-surface", className)}
      {...props}
    />
  );
}
