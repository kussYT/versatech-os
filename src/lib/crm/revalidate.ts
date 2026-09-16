import { revalidatePath } from "next/cache";

export function revalidateCrm(companyId?: string) {
  revalidatePath("/");
  revalidatePath("/prospection");
  revalidatePath("/entreprises");
  revalidatePath("/relances");
  revalidatePath("/pipeline");
  revalidatePath("/clients");

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
  revalidatePath("/calendrier");
  revalidateCrm(companyId);
}

export function revalidateQuotes(companyId?: string) {
  revalidatePath("/devis");
  revalidatePath("/finances");
  revalidatePath("/analytics");
  revalidatePath("/");
  revalidatePath("/pipeline");
  revalidateCrm(companyId);
}

export function revalidateFinances(companyId?: string, projectId?: string) {
  revalidatePath("/finances");
  revalidatePath("/analytics");
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/devis");

  if (projectId) {
    revalidatePath(`/projets/${projectId}`);
  }

  revalidateCrm(companyId);
}

export function revalidateProjects(companyId?: string, projectId?: string) {
  revalidatePath("/projets");
  revalidatePath("/taches");
  revalidatePath("/clients");
  revalidatePath("/finances");
  revalidatePath("/");
  revalidatePath("/calendrier");

  if (projectId) {
    revalidatePath(`/projets/${projectId}`);
  }

  revalidateCrm(companyId);
}

export function revalidateCalendar(companyId?: string, projectId?: string) {
  revalidatePath("/calendrier");
  revalidatePath("/");

  if (projectId) {
    revalidatePath(`/projets/${projectId}`);
  }

  if (companyId) {
    revalidatePath(`/entreprises/${companyId}`);
  }
}

export function revalidateGithub(companyId?: string, projectId?: string) {
  revalidatePath("/github");
  revalidateProjects(companyId, projectId);
}

export function revalidateDocuments(companyId?: string | null, projectId?: string | null) {
  revalidatePath("/documents");

  if (projectId) {
    revalidatePath(`/projets/${projectId}`);
  }

  if (companyId) {
    revalidatePath(`/entreprises/${companyId}`);
  }
}

export function revalidateMaintenance(companyId?: string | null, projectId?: string | null) {
  revalidatePath("/maintenance");
  revalidatePath("/analytics");
  revalidatePath("/");

  if (projectId) {
    revalidatePath(`/projets/${projectId}`);
  }

  if (companyId) {
    revalidateCrm(companyId);
  }
}
