import { revalidatePath } from "next/cache";

export function revalidateCrm(companyId?: string) {
  revalidatePath("/prospection");
  revalidatePath("/entreprises");
  revalidatePath("/relances");

  if (companyId) {
    revalidatePath(`/entreprises/${companyId}`);
  }
}

export function revalidatePipeline(companyId?: string) {
  revalidatePath("/pipeline");
  revalidatePath("/");
  revalidateCrm(companyId);
}

export function revalidateFollowUps(companyId?: string) {
  revalidatePath("/relances");
  revalidatePath("/");
  revalidateCrm(companyId);
}

export function revalidateQuotes(companyId?: string) {
  revalidatePath("/devis");
  revalidatePath("/");
  revalidatePath("/pipeline");
  revalidateCrm(companyId);
}

export function revalidateProjects(companyId?: string, projectId?: string) {
  revalidatePath("/projets");
  revalidatePath("/clients");
  revalidatePath("/");

  if (projectId) {
    revalidatePath(`/projets/${projectId}`);
  }

  revalidateCrm(companyId);
}
