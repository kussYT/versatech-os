import { z } from "zod";
import { fieldErrorsFromZod } from "@/lib/validations/company";

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export type GitHubRepositoryRef = {
  owner: string;
  name: string;
};

export const associateRepositorySchema = z.object({
  projectId: z.string().min(1, "Projet introuvable"),
  repository: z.string().trim().min(1, "Indiquez owner/nom ou une URL GitHub"),
});

export const unlinkRepositorySchema = z.object({
  repositoryId: z.string().min(1, "Repository introuvable"),
});

export type AssociateRepositoryInput = z.infer<typeof associateRepositorySchema>;
export type UnlinkRepositoryInput = z.infer<typeof unlinkRepositorySchema>;

export function parseGitHubRepositoryRef(raw: string): GitHubRepositoryRef | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const sshMatch = /^git@github\.com:([^/]+)\/(.+)$/i.exec(value);
  if (sshMatch) {
    return sanitizeRef(sshMatch[1], sshMatch[2]);
  }

  const urlCandidate = toGitHubUrl(value);
  if (urlCandidate) {
    try {
      const url = new URL(urlCandidate);
      if (!isGitHubHost(url.hostname)) {
        return null;
      }

      const [owner, name] = url.pathname.replace(/^\/+/, "").split("/");
      return sanitizeRef(owner, name);
    } catch {
      return null;
    }
  }

  const shortMatch = /^([^/\s]+)\/([^/\s]+)$/.exec(value);
  if (!shortMatch) {
    return null;
  }

  return sanitizeRef(shortMatch[1], shortMatch[2]);
}

export { fieldErrorsFromZod };

function toGitHubUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(www\.)?github\.com\//i.test(value)) {
    return `https://${value}`;
  }

  return null;
}

function isGitHubHost(hostname: string) {
  return hostname === "github.com" || hostname === "www.github.com";
}

function sanitizeRef(owner: string | undefined, name: string | undefined): GitHubRepositoryRef | null {
  if (!owner || !name) {
    return null;
  }

  const cleanOwner = owner.trim();
  const cleanName = name.trim().replace(/\.git$/i, "");

  if (!OWNER_PATTERN.test(cleanOwner) || !NAME_PATTERN.test(cleanName)) {
    return null;
  }

  if (cleanName === "." || cleanName === "..") {
    return null;
  }

  return { owner: cleanOwner, name: cleanName };
}
