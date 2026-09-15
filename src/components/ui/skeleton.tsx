import { cn } from "@/lib/cn";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface-high motion-safe:animate-pulse",
        className,
      )}
      aria-hidden="true"
    />
  );
}
