import "server-only";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const REQUEST_TIMEOUT_MS = 8_000;
const COMMIT_PAGE_SIZE = 8;

export type GitHubCommit = {
  sha: string;
  shortSha: string;
  message: string;
  author: string | null;
  committedAt: string;
  url: string;
};

export type GitHubRepositoryInfo = {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  externalId: string;
  lastActivityAt: string | null;
};

export type GitHubErrorCode =
  | "unconfigured"
  | "not_found"
  | "forbidden"
  | "unauthorized"
  | "unavailable";

export type GitHubFetchError = {
  code: GitHubErrorCode;
  message: string;
};

export type GitHubFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: GitHubFetchError };

type GitHubRepoResponse = {
  id: number;
  name: string;
  html_url: string;
  default_branch: string;
  pushed_at: string | null;
  updated_at: string | null;
  owner: {
    login: string;
  };
};

type GitHubCommitResponse = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string | null; date: string } | null;
    committer: { name: string | null; date: string } | null;
  };
  author: { login: string } | null;
};

export function getGitHubToken(): string | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  return token ? token : null;
}

export function isGitHubConfigured() {
  return getGitHubToken() !== null;
}

export async function fetchGitHubRepository(
  owner: string,
  name: string,
): Promise<GitHubFetchResult<GitHubRepositoryInfo>> {
  const result = await githubGet<GitHubRepoResponse>(repoPath(owner, name));
  if (!result.ok) {
    return result;
  }

  return { ok: true, data: mapRepository(result.data) };
}

export async function fetchGitHubRepositoryActivity(
  owner: string,
  name: string,
): Promise<
  GitHubFetchResult<{
    repository: GitHubRepositoryInfo;
    commits: GitHubCommit[];
  }>
> {
  const repository = await fetchGitHubRepository(owner, name);
  if (!repository.ok) {
    return repository;
  }

  const commitsPath = `${repoPath(repository.data.owner, repository.data.name)}/commits?sha=${encodeURIComponent(repository.data.defaultBranch)}&per_page=${COMMIT_PAGE_SIZE}`;
  const commits = await githubGet<GitHubCommitResponse[]>(commitsPath);

  if (!commits.ok) {
    return {
      ok: true,
      data: {
        repository: repository.data,
        commits: [],
      },
    };
  }

  return {
    ok: true,
    data: {
      repository: repository.data,
      commits: commits.data.map(mapCommit),
    },
  };
}

function repoPath(owner: string, name: string) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

async function githubGet<T>(path: string): Promise<GitHubFetchResult<T>> {
  const token = getGitHubToken();
  if (!token) {
    return {
      ok: false,
      error: {
        code: "unconfigured",
        message: "GitHub n'est pas configuré sur le serveur.",
      },
    };
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "VersaTech-OS",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 404) {
      return {
        ok: false,
        error: {
          code: "not_found",
          message: "Repository introuvable ou inaccessible avec le jeton actuel.",
        },
      };
    }

    if (response.status === 401) {
      return {
        ok: false,
        error: {
          code: "unauthorized",
          message: "Le jeton GitHub est invalide.",
        },
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        error: {
          code: "forbidden",
          message: "Accès GitHub refusé ou quota API atteint.",
        },
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: "unavailable",
          message: "GitHub est temporairement indisponible.",
        },
      };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: {
        code: "unavailable",
        message: "Impossible de joindre l'API GitHub.",
      },
    };
  }
}

function mapRepository(payload: GitHubRepoResponse): GitHubRepositoryInfo {
  return {
    owner: payload.owner.login,
    name: payload.name,
    url: payload.html_url,
    defaultBranch: payload.default_branch || "main",
    externalId: String(payload.id),
    lastActivityAt: payload.pushed_at ?? payload.updated_at,
  };
}

function mapCommit(payload: GitHubCommitResponse): GitHubCommit {
  const message = payload.commit.message.split("\n")[0]?.trim() || "Commit";
  const committedAt =
    payload.commit.committer?.date ?? payload.commit.author?.date ?? new Date().toISOString();

  return {
    sha: payload.sha,
    shortSha: payload.sha.slice(0, 7),
    message,
    author: payload.commit.author?.name ?? payload.author?.login ?? null,
    committedAt,
    url: payload.html_url,
  };
}
