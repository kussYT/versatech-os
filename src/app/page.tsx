import type { Metadata } from "next";
import { CollectionsChart } from "@/components/dashboard/collections-chart";
import { HomeActiveProjects } from "@/components/dashboard/home-active-projects";
import { HomeCalendarCard } from "@/components/dashboard/home-calendar-card";
import { HomeHero } from "@/components/dashboard/home-hero";
import { HomeKpis } from "@/components/dashboard/home-kpis";
import { HomePriorityActions } from "@/components/dashboard/home-priority-actions";
import { HomeRecentActivity } from "@/components/dashboard/home-recent-activity";
import { HomeRecentClients } from "@/components/dashboard/home-recent-clients";
import { HomeTourCard } from "@/components/dashboard/home-tour-card";
import { requireAuthenticatedUser } from "@/lib/auth/dal";
import { formatLongDate, parisParts } from "@/lib/dates";
import { loadDashboardHome } from "@/lib/queries/dashboard-home";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

function firstNameFrom(name: string) {
  const first = name.trim().split(/\s+/).filter(Boolean)[0];
  return first || "là";
}

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function TodayPage({
  searchParams,
}: PageProps<"/">) {
  const actor = await requireAuthenticatedUser();
  const params = await searchParams;
  const now = new Date();
  const currentYear = parisParts(now).year;
  const requested = Number(firstString(params.annee));
  const collectionYear =
    Number.isInteger(requested) && requested >= 1970 && requested <= 9999
      ? requested
      : currentYear;

  const home = await loadDashboardHome(now, collectionYear);

  return (
    <div className="mx-auto flex max-w-[92rem] flex-col gap-4 sm:gap-5 lg:gap-6">
      <HomeHero
        firstName={firstNameFrom(actor.name)}
        summary={home.summary}
        insight={home.insight}
        longDate={formatLongDate(now)}
        clock={`${String(parisParts(now).hour).padStart(2, "0")}:${String(parisParts(now).minute).padStart(2, "0")}`}
      />

      <HomeKpis
        finance={home.finance}
        waitingQuotes={home.waitingQuotes}
        activeProjects={home.activeProjects}
        urgentFollowUps={home.urgentFollowUps}
      />

      <div className="grid gap-4 xl:grid-cols-12 lg:gap-5">
        <div className="xl:col-span-5">
          <CollectionsChart
            year={home.monthlyCollections.year}
            currentYear={currentYear}
            years={home.availableCollectionYears}
            total={home.monthlyCollections.total}
            points={home.monthlyCollections.points.map((point) => ({
              month: point.month,
              label: point.label,
              amount: point.amount,
              cents: point.cents.toString(),
            }))}
          />
        </div>
        <div className="xl:col-span-4">
          <HomeCalendarCard items={home.upcomingAgenda} now={now} />
        </div>
        <div className="xl:col-span-3">
          <HomeRecentClients clients={home.recentClients} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12 lg:gap-5">
        <div className="xl:col-span-5">
          <HomePriorityActions actions={home.priorityActions} />
        </div>
        <div className="xl:col-span-4">
          <HomeActiveProjects projects={home.activeProjectsList} />
        </div>
        <div className="xl:col-span-3">
          <HomeRecentActivity items={home.recentActivity} />
        </div>
      </div>

      <HomeTourCard tour={home.tour} />
    </div>
  );
}
