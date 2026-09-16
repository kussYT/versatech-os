import "server-only";

import {
  fetchGitHubRepositoryActivity,
  isGitHubConfigured,
  type GitHubCommit,
} from "@/lib/integrations/github";
import { prisma } from "@/lib/db/prisma";

export type LinkedRepository = {
  id: string;
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
};

export type GitHubRepositorySnapshot = LinkedRepository & {
  lastActivityAt: string | null;
  commits: GitHubCommit[];
  live: "ok" | "unconfigured" | "error";
  errorMessage: string | null;
};

export type GitHubProjectSnapshot = {
  configured: boolean;
  repositories: GitHubRepositorySnapshot[];
};

export type GitHubOverviewItem = GitHubRepositorySnapshot & {
  project: {
    id: string;
    name: string;
    companyName: string;
  };
};

export type GitHubOverview = {
  configured: boolean;
  items: GitHubOverviewItem[];
};

export async function getGitHubProjectSnapshot(
  repositories: LinkedRepository[],
): Promise<GitHubProjectSnapshot> {
  const configured = isGitHubConfigured();
  const snapshots = await Promise.all(
    repositories.map((repository) => loadRepositorySnapshot(repository, configured)),
  );

  return { configured, repositories: snapshots };
}

export async function getGitHubOverview(): Promise<GitHubOverview> {
  const configured = isGitHubConfigured();
  const repositories = await prisma.repository.findMany({
    where: { provider: "github" },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      project: {
        select: {
          id: true,
          name: true,
          company: { select: { name: true } },
        },
      },
    },
  });

  const items = await Promise.all(
    repositories.map(async (repository) => {
      const snapshot = await loadRepositorySnapshot(
        {
          id: repository.id,
          owner: repository.owner,
          name: repository.name,
          url: repository.url,
          defaultBranch: repository.defaultBranch,
        },
        configured,
      );

      return {
        ...snapshot,
        project: {
          id: repository.project.id,
          name: repository.project.name,
          companyName: repository.project.company.name,
        },
      };
    }),
  );

  return { configured, items };
}

async function loadRepositorySnapshot(
  repository: LinkedRepository,
  configured: boolean,
): Promise<GitHubRepositorySnapshot> {
  if (!configured) {
    return {
      ...repository,
      lastActivityAt: null,
      commits: [],
      live: "unconfigured",
      errorMessage: null,
    };
  }

  const activity = await fetchGitHubRepositoryActivity(repository.owner, repository.name);
  if (!activity.ok) {
    return {
      ...repository,
      lastActivityAt: null,
      commits: [],
      live: "error",
      errorMessage: activity.error.message,
    };
  }

  return {
    id: repository.id,
    owner: activity.data.repository.owner,
    name: activity.data.repository.name,
    url: activity.data.repository.url,
    defaultBranch: activity.data.repository.defaultBranch,
    lastActivityAt: activity.data.repository.lastActivityAt,
    commits: activity.data.commits,
    live: "ok",
    errorMessage: null,
  };
}
