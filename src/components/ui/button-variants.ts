import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-button ease-out disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:-translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "btn-primary relative bg-primary text-foreground hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "border border-border bg-surface-high text-foreground hover:border-primary/40 hover:bg-surface",
        ghost: "text-muted hover:bg-surface-high hover:text-foreground",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-3.5 text-body",
        lg: "h-10 px-4 text-body",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
