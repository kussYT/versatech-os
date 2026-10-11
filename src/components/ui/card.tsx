import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <section
      className={cn("glass-card card-sheen", className)}
      {...props}
    />
  );
}
