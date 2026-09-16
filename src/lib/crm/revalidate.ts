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
