"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { clearPointerSpot, setPointerSpot } from "@/lib/pointer-spot";

type PremiumCardProps = HTMLAttributes<HTMLElement>;

export function PremiumCard({
  className,
  onPointerMove,
  onPointerLeave,
  children,
  ...props
}: PremiumCardProps) {
  return (
    <section
      className={cn(
        "foil-premium card-sheen rounded-card border border-border bg-surface motion-safe:transition-transform motion-safe:duration-hover motion-safe:hover:-translate-y-px",
        className,
      )}
      onPointerMove={(event) => {
        setPointerSpot(event);
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        clearPointerSpot(event);
        onPointerLeave?.(event);
      }}
      {...props}
    >
      <span className="foil-wash" aria-hidden="true" />
      {children}
    </section>
  );
}
