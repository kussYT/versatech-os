import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-button ease-out disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:-translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "btn-primary relative bg-primary text-white hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "border border-white/80 bg-white/70 text-foreground shadow-[0_1px_2px_rgb(31_41_80/0.06)] backdrop-blur-md hover:border-primary/30 hover:bg-white/90",
        ghost: "text-muted hover:bg-black/[0.045] hover:text-foreground",
        danger: "bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-3.5 text-body",
        lg: "h-10 px-4 text-body",
        icon: "size-9",
      },
      shape: {
        default: "",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      shape: "default",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
