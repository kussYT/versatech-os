import Image from "next/image";
import type { DailyInsight } from "@/lib/dashboard/insight";
import type { DashboardSummary } from "@/lib/queries/dashboard-home";
import { cn } from "@/lib/cn";

type HomeHeroProps = {
  firstName: string;
  summary: DashboardSummary;
  insight: DailyInsight;
  /** Chaînes déjà formatées côté serveur (Europe/Paris) — évite les écarts d'hydratation. */
  longDate: string;
  clock: string;
};

const INSIGHT_TONE: Record<DailyInsight["tone"], string> = {
  urgent: "border-danger/25 bg-white/70 text-danger",
  attention: "border-warning/30 bg-white/70 text-warning",
  calm: "border-primary/20 bg-white/70 text-primary",
  neutral: "border-white/70 bg-white/65 text-foreground",
};

function summaryLine(summary: DashboardSummary) {
  const actions = `${summary.priorityActionCount} action${summary.priorityActionCount === 1 ? "" : "s"} prioritaire${summary.priorityActionCount === 1 ? "" : "s"}`;
  const agenda = `${summary.agendaCount} rendez-vous`;
  const quotes = `${summary.quotesToFollowCount} devis à relancer`;
  return `${actions} • ${agenda} • ${quotes}`;
}

export function HomeHero({ firstName, summary, insight, longDate, clock }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-white/70 shadow-[0_12px_40px_rgb(31_41_80/0.1)]">
      <div className="absolute inset-0">
        <Image
          src="/images/dashboard-hero-mountains.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1200px"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1c1c1e]/45 via-[#1c1c1e]/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1e]/35 via-transparent to-[#1c1c1e]/10" />
      </div>

      <div className="relative flex min-h-[220px] flex-col justify-between gap-6 p-5 sm:min-h-[240px] sm:p-7 lg:min-h-[260px] lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-xl text-white">
            <p className="text-body font-medium text-white/90">
              Bonjour {firstName}
            </p>
            <h1 className="mt-2 max-w-[18ch] text-[1.7rem] font-semibold tracking-[-0.03em] text-white sm:text-[2rem] lg:text-[2.15rem]">
              Concentrons-nous sur l&apos;essentiel aujourd&apos;hui.
            </h1>
            <p className="mt-3 text-meta text-white/85 sm:text-body">
              {summaryLine(summary)}
            </p>
          </div>
          <div className="hidden shrink-0 text-right text-white md:block">
            <p className="text-meta capitalize text-white/80">{longDate}</p>
            <p className="mt-1 text-[2rem] font-semibold tracking-tight tabular-nums leading-none">
              {clock}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p
            className={cn(
              "max-w-md rounded-full border px-4 py-2 text-meta font-medium backdrop-blur-md",
              INSIGHT_TONE[insight.tone],
            )}
          >
            {insight.message}
          </p>
          <aside className="hidden max-w-[15.5rem] rounded-2xl border border-white/60 bg-white/50 px-3.5 py-3 text-meta text-foreground shadow-[0_8px_24px_rgb(15_23_42/0.12)] backdrop-blur-xl lg:block">
            <p className="leading-relaxed">
              « Des idées claires pour des projets qui avancent. »
            </p>
            <p className="mt-1.5 font-medium text-primary">VersaTech</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
