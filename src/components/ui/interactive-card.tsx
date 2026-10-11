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
        "glass-card motion-safe:transition-transform motion-safe:duration-hover motion-safe:hover:-translate-y-0.5",
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
      {children}
    </section>
  );
}
