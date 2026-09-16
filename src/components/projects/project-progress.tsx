export function ProjectProgress({ value }: { value: number }) {
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-high">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="font-mono text-meta tabular-nums text-muted">{value} %</span>
    </div>
  );
}
