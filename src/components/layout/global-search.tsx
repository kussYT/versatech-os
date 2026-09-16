"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  FolderKanban,
  Kanban,
  Search,
  UserRound,
} from "lucide-react";
import { searchGlobal } from "@/actions/search";
import { EmptyState } from "@/components/ui/empty-state";
import {
  emptySearchResults,
  flattenSearchHits,
  isSearchableQuery,
  normalizeSearchQuery,
  SEARCH_KIND_LABELS,
  SEARCH_MIN_LENGTH,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from "@/lib/crm/search";
import { cn } from "@/lib/cn";

const KIND_ICONS: Record<SearchKind, typeof Building2> = {
  company: Building2,
  contact: UserRound,
  project: FolderKanban,
  opportunity: Kanban,
  document: FileText,
};

type GlobalSearchProps = {
  triggerClassName?: string;
};

export function GlobalSearch({ triggerClassName }: GlobalSearchProps) {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<SearchResults>(emptySearchResults());
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const normalizedQuery = query.trim();
  const results =
    isSearchableQuery(query) && fetched.query === normalizeSearchQuery(query)
      ? fetched
      : emptySearchResults(normalizedQuery);
  const hits = useMemo(() => flattenSearchHits(results), [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setFetched(emptySearchResults());
    setActiveIndex(0);
  }, []);

  const goTo = useCallback(
    (hit: SearchHit) => {
      close();
      router.push(hit.href);
    },
    [close, router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const mySeq = ++searchSeq.current;
    if (!isSearchableQuery(query)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const requested = query;
      startTransition(async () => {
        const next = await searchGlobal(requested);
        if (searchSeq.current === mySeq) {
          setFetched(next);
          setActiveIndex(0);
        }
      });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [query]);

  function onDialogKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (hits.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % hits.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + hits.length) % hits.length);
      return;
    }

    if (event.key === "Enter") {
      const hit = hits[activeIndex];
      if (hit) {
        event.preventDefault();
        goTo(hit);
      }
    }
  }

  const tooShort = query.trim().length > 0 && !isSearchableQuery(query);
  const noResults =
    isSearchableQuery(query) && !pending && results.total === 0;

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label="Recherche globale"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Rechercher…</span>
        <kbd className="hidden rounded-md border border-border bg-surface-high px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
          Ctrl/Cmd + K
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        className="vt-command"
        aria-labelledby={`${inputId}-title`}
        onClose={close}
        onKeyDown={onDialogKeyDown}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            close();
          }
        }}
      >
        <div className="border-b border-border px-4 py-3">
          <p id={`${inputId}-title`} className="sr-only">
            Recherche globale
          </p>
          <label className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              id={inputId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder="Entreprises, contacts, projets…"
              className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={hits.length > 0}
              aria-controls={listId}
              aria-activedescendant={
                hits[activeIndex]
                  ? `${listId}-${hits[activeIndex].kind}-${hits[activeIndex].id}`
                  : undefined
              }
            />
            {pending ? (
              <span className="text-meta text-muted">Recherche…</span>
            ) : null}
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
          {query.trim() === "" ? (
            <EmptyState
              title="Rechercher dans l'OS"
              description="Entreprises, contacts, projets, opportunités et documents. Tapez au moins 2 caractères."
            />
          ) : null}

          {tooShort ? (
            <EmptyState
              title="Encore un caractère"
              description={`La recherche démarre à ${SEARCH_MIN_LENGTH} caractères.`}
            />
          ) : null}

          {noResults ? (
            <EmptyState
              title={`Aucun résultat pour « ${results.query || query.trim()} »`}
              description="Essayez un nom d'entreprise, un contact, un projet ou un document."
            />
          ) : null}

          {results.groups.length > 0 ? (
            <div id={listId} role="listbox" aria-label="Résultats de recherche">
              {results.groups.map((group) => (
                <section key={group.kind} className="mb-2">
                  <h3 className="px-2 py-1.5 text-meta font-medium tracking-[0.08em] text-muted uppercase">
                    {SEARCH_KIND_LABELS[group.kind]}
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {group.hits.map((hit) => {
                      const Icon = KIND_ICONS[hit.kind];
                      const flatIndex = hits.findIndex((item) => item.id === hit.id && item.kind === hit.kind);
                      const active = flatIndex === activeIndex;
                      return (
                        <li key={`${hit.kind}-${hit.id}`}>
                          <button
                            type="button"
                            id={`${listId}-${hit.kind}-${hit.id}`}
                            role="option"
                            aria-selected={active}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-hover",
                              active
                                ? "bg-primary/15 text-foreground"
                                : "text-foreground hover:bg-surface-high",
                            )}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            onClick={() => goTo(hit)}
                          >
                            <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block truncate text-body font-medium">{hit.title}</span>
                              {hit.subtitle ? (
                                <span className="mt-0.5 block truncate text-meta text-muted">
                                  {hit.subtitle}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
