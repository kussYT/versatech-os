import type { Metadata } from "next";
import { requireAuthenticatedUser } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/page-header";
import { GoogleCalendarCard } from "@/components/settings/google-calendar-card";
import { getGoogleConnectionPublic } from "@/lib/integrations/google/connection";

export const metadata: Metadata = {
  title: "Paramètres",
};

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ParametresPage({
  searchParams,
}: PageProps<"/parametres">) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const flash = firstString(params.google) ?? null;
  const connection = await getGoogleConnectionPublic(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="Profil, préférences et intégrations (Google Calendar)."
      />
      <GoogleCalendarCard connection={connection} flash={flash} />
    </div>
  );
}
