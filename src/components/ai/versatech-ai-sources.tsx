import type { ChatSourceLink } from "@/components/ai/sources";
import { isPublicHttpUrl } from "@/components/ai/sources";

export function VersatechAiSources({ sources }: { sources: ChatSourceLink[] }) {
  const visible = sources.filter(
    (item) => isPublicHttpUrl(item.url) && !/searxng|searx/i.test(item.title ?? ""),
  );
  if (visible.length === 0) {
    return null;
  }

  return (
    <nav className="vt-ai-sources" aria-label="Sources">
      <p className="vt-ai-sources-label">Sources</p>
      <ul className="vt-ai-sources-list">
        {visible.map((item) => (
          <li key={item.url}>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              {item.title ?? hostnameOf(item.url)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
