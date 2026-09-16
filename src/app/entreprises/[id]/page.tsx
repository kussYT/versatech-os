import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyHub } from "@/components/crm/company-hub";
import { getCompanyDetail } from "@/lib/queries/companies";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/entreprises/[id]">): Promise<Metadata> {
  const { id } = await params;
  const company = await getCompanyDetail(id);
  return { title: company?.name ?? "Entreprise" };
}

export default async function CompanyPage({
  params,
}: PageProps<"/entreprises/[id]">) {
  const { id } = await params;
  const company = await getCompanyDetail(id);

  if (!company) {
    notFound();
  }

  return <CompanyHub company={company} />;
}
