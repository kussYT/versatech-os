"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { clearPointerSpot, setPointerSpot } from "@/lib/pointer-spot";
import {
  buttonVariants,
  type ButtonVariantProps,
} from "@/components/ui/button-variants";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariantProps;

export { buttonVariants };

export function Button({
  className,
  variant,
  size,
  type = "button",
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: ButtonProps) {
  const isPrimary = variant === "primary" || variant == null;

  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      onPointerMove={
        isPrimary
          ? (event) => {
              setPointerSpot(event);
              onPointerMove?.(event);
            }
          : onPointerMove
      }
      onPointerLeave={
        isPrimary
          ? (event) => {
              clearPointerSpot(event);
              onPointerLeave?.(event);
            }
          : onPointerLeave
      }
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
}
