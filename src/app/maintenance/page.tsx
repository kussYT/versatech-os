import type { Metadata } from "next";
import { MaintenanceExplorer } from "@/components/maintenance/maintenance-explorer";
import {
  listMaintenanceAssociationOptions,
  listMaintenanceOverview,
} from "@/lib/queries/maintenance";

export const metadata: Metadata = {
  title: "Maintenance",
};

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const [overview, associations] = await Promise.all([
    listMaintenanceOverview(),
    listMaintenanceAssociationOptions(),
  ]);

  return <MaintenanceExplorer overview={overview} associations={associations} />;
}
