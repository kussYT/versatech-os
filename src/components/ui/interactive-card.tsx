"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { clearPointerSpot, setPointerSpot } from "@/lib/pointer-spot";

type InteractiveCardProps = HTMLAttributes<HTMLElement>;

export function InteractiveCard({
  className,
  onPointerMove,
  onPointerLeave,
  children,
  ...props
}: InteractiveCardProps) {
  return (
    <section
      className={cn(
        "foil card-sheen rounded-card border border-border bg-surface motion-safe:transition-transform motion-safe:duration-hover motion-safe:hover:-translate-y-px",
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
