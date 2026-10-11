"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/crm/form-data";
import type { MonthlyCollectionPoint } from "@/lib/dashboard/monthly-collections";
import { cn } from "@/lib/cn";

type ChartPoint = {
  month: number;
  label: string;
  amount: string;
  /** Cents as decimal string for safe serialization. */
  cents: string;
};

type CollectionsChartProps = {
  year: number;
  /** Année civile Paris courante — sélectionner cette année ramène à `/`. */
  currentYear: number;
  years: number[];
  points: ChartPoint[];
  total: string;
};

function toPoints(points: ChartPoint[]): Array<MonthlyCollectionPoint & { cents: bigint }> {
  return points.map((point) => ({
    ...point,
    cents: BigInt(point.cents),
  }));
}

export function CollectionsChart({
  year,
  currentYear,
  years,
  points,
  total,
}: CollectionsChartProps) {
  const router = useRouter();
  const gradientId = useId();
  const series = useMemo(() => toPoints(points), [points]);
  const maxCents = series.reduce(
    (max, point) => (point.cents > max ? point.cents : max),
    BigInt(0),
  );
  const [hover, setHover] = useState<number | null>(null);
  const hasData = maxCents > BigInt(0);

  const width = 560;
  const height = 220;
  const padX = 28;
  const padTop = 24;
  const padBottom = 36;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;
  const gap = 10;
  const barW = (chartW - gap * (series.length - 1)) / series.length;

  return (
    <section className="glass-card flex h-full flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-section text-foreground">Encaissements mensuels</h2>
          <p className="mt-1 text-meta text-muted">
            Total {year} · {formatMoney(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="collections-year">
            Année
          </label>
          <select
            id="collections-year"
            className="rounded-full border border-border bg-white/70 px-3 py-1.5 text-meta text-foreground backdrop-blur-sm"
            value={year}
            onChange={(event) => {
              const next = Number(event.target.value);
              router.push(next === currentYear ? "/" : `/?annee=${next}`);
            }}
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="rounded-full border border-border bg-white/70 px-3 py-1.5 text-meta text-muted">
            Mois
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-white/40 px-4 py-10 text-center">
          <p className="text-body font-medium text-foreground">Aucun encaissement en {year}</p>
          <p className="mt-1 max-w-sm text-meta text-muted">
            Les barres apparaîtront dès qu&apos;un paiement confirmé (PAID) aura une date d&apos;encaissement.
          </p>
        </div>
      ) : (
        <div className="relative mt-4 flex-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Encaissements mensuels ${year}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#007AFF" stopOpacity="0.75" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padTop + chartH * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="rgb(31 41 80 / 0.08)"
                  strokeWidth="1"
                />
              );
            })}
            {series.map((point, index) => {
              const ratio =
                maxCents === BigInt(0)
                  ? 0
                  : Number((point.cents * BigInt(1000)) / maxCents) / 1000;
              const barH = Math.max(point.cents > BigInt(0) ? 4 : 0, ratio * chartH);
              const x = padX + index * (barW + gap);
              const y = padTop + chartH - barH;
              const active = hover === index;
              return (
                <g key={point.month}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={8}
                    ry={8}
                    fill={`url(#${gradientId})`}
                    opacity={active || hover === null ? 1 : 0.45}
                    className="transition-opacity duration-hover"
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(index)}
                    onBlur={() => setHover(null)}
                    tabIndex={point.cents > BigInt(0) ? 0 : -1}
                    aria-label={`${point.label} ${formatMoney(point.amount)}`}
                  />
                  <text
                    x={x + barW / 2}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-faint"
                    style={{ fontSize: 11 }}
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover !== null && series[hover] ? (
            <div
              className={cn(
                "pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-center shadow-soft backdrop-blur-md",
              )}
              role="status"
            >
              <p className="text-meta font-medium capitalize text-muted">
                {series[hover].label} {year}
              </p>
              <p className="text-body font-semibold tabular-nums text-foreground">
                {formatMoney(series[hover].amount)}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
