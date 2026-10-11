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
  Receipt,
  Search,
  UserRound,
} from "lucide-react";
import { createFollowUp } from "@/actions/follow-ups";
import { updateOpportunityStage } from "@/actions/opportunities";
import { searchGlobal } from "@/actions/search";
import { CreateProspectDialog } from "@/components/crm/create-prospect-dialog";
import { QuickInteractionPanel } from "@/components/crm/quick-interaction-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { idleActionResult } from "@/lib/crm/action-result";
import { cn } from "@/lib/cn";
import {
  contextualCommands,
  EMPTY_PALETTE_COMMANDS,
  emptySearchResults,
  flattenSearchHits,
  isCurrentSearch,
  isSearchableQuery,
  movePaletteIndex,
  normalizeSearchQuery,
  openStageCommands,
  screenAfterEscape,
  SEARCH_DEBOUNCE_MS,
  SEARCH_KIND_LABELS,
  SEARCH_LIMIT_PER_KIND,
  SEARCH_MIN_LENGTH,
  type PaletteCommand,
  type PaletteScreen,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from "@/lib/crm/search";
import { toDateTimeLocalValue } from "@/lib/dates";
import { kanbanFollowUpDue, type KanbanFollowUpPreset } from "@/lib/pipeline/kanban";

const KIND_ICONS: Record<SearchKind, typeof Building2> = {
  company: Building2,
  contact: UserRound,
  project: FolderKanban,
  opportunity: Kanban,
  quote: Receipt,
  document: FileText,
};

type Target = {
  companyId: string;
  companyName: string;
  opportunityId: string | null;
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
  const restoreRef = useRef<HTMLElement | null>(null);
  const searchSeq = useRef(0);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [prospectOpen, setProspectOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<SearchResults>(emptySearchResults());
  const [activeIndex, setActiveIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [screen, setScreen] = useState<PaletteScreen>("search");
  const [pickIntent, setPickIntent] = useState<"interaction" | "follow-up">("interaction");
  const [target, setTarget] = useState<Target | null>(null);
  const [stageOpportunityId, setStageOpportunityId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [pending, startTransition] = useTransition();

  const normalizedQuery = query.trim();
  const results =
    isSearchableQuery(query) && fetched.query === normalizeSearchQuery(query)
      ? fetched
      : emptySearchResults(normalizedQuery);
  const hits = useMemo(() => {
    const flat = flattenSearchHits(results);
    return screen === "pick-company" ? flat.filter((hit) => hit.kind === "company") : flat;
  }, [results, screen]);
  const commands =
    screen === "stage" && stageOpportunityId
      ? openStageCommands(stageOpportunityId)
      : screen === "search" && query.trim() === ""
        ? EMPTY_PALETTE_COMMANDS
        : [];
  const showingCommands = commands.length > 0 && screen !== "pick-company";
  const activeHit = hits[activeIndex];
  const hitActions = !showingCommands && activeHit && screen === "search" ? contextualCommands(activeHit) : [];

  const close = useCallback(() => {
    setOpen(false);
    openRef.current = false;
    setQuery("");
    setFetched(emptySearchResults());
    setActiveIndex(0);
    setActionIndex(0);
    setScreen("search");
    setTarget(null);
    setNotice(null);
    const restore = restoreRef.current;
    restoreRef.current = null;
    requestAnimationFrame(() => restore?.focus());
  }, []);

  const openPalette = useCallback(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openRef.current = true;
    setOpen(true);
  }, []);

  const goTo = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k" || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      if (openRef.current) {
        close();
        return;
      }
      openPalette();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, openPalette]);

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
    const requestId = ++searchSeq.current;
    if (!isSearchableQuery(query) || (screen !== "search" && screen !== "pick-company")) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const requested = query;
      startTransition(async () => {
        const next = await searchGlobal(requested);
        if (isCurrentSearch(requestId, searchSeq.current)) {
          setFetched(next);
          setActiveIndex(0);
          setActionIndex(0);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [query, screen]);

  function beginIntent(intent: "interaction" | "follow-up", next?: Target) {
    if (next) {
      setTarget(next);
      setScreen(intent);
      setNotice(null);
      return;
    }
    setPickIntent(intent);
    setScreen("pick-company");
    setQuery("");
    setNotice(null);
  }

  function runCommand(command: PaletteCommand, fromHit?: SearchHit) {
    if (command.action.type === "navigate") {
      goTo(command.action.href);
      return;
    }
    if (command.action.type === "create-prospect") {
      close();
      setProspectOpen(true);
      return;
    }
    if (command.action.type === "interaction" || command.action.type === "follow-up") {
      const next = fromHit ? targetFromHit(fromHit) : target;
      beginIntent(command.action.type, next?.companyId ? next : undefined);
      return;
    }
    if (command.action.type === "open-stage") {
      setStageOpportunityId(command.action.opportunityId);
      setScreen("stage");
      setActiveIndex(0);
      return;
    }
    const data = new FormData();
    data.set("opportunityId", command.action.opportunityId);
    data.set("stage", command.action.stage);
    data.set("lostReason", "");
    startTransition(async () => {
      const result = await updateOpportunityStage(idleActionResult, data);
      setNotice(result.message ?? (result.ok ? "Étape mise à jour." : "Impossible de changer l'étape."));
      if (result.ok) {
        setScreen("search");
      }
    });
  }

  function chooseHit(hit: SearchHit) {
    const actions = contextualCommands(hit);
    const command = actions[actionIndex] ?? actions[0];
    if (command) {
      runCommand(command, hit);
      return;
    }
    goTo(hit.href);
  }

  function onDialogKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      const next = screenAfterEscape(screen);
      if (next.close) {
        close();
        return;
      }
      setScreen(next.screen);
      setNotice(null);
      return;
    }
    if (screen === "interaction" || screen === "follow-up") {
      return;
    }
    const length = showingCommands ? commands.length : hits.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key;
      setActiveIndex((index) => movePaletteIndex(index, direction, length));
      setActionIndex(0);
      return;
    }
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && hitActions.length > 0) {
      event.preventDefault();
      setActionIndex((index) => movePaletteIndex(index, event.key === "ArrowRight" ? "ArrowDown" : "ArrowUp", hitActions.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (showingCommands) {
        const command = commands[activeIndex];
        if (command) {
          runCommand(command);
        }
        return;
      }
      if (screen === "pick-company" && activeHit?.kind === "company") {
        beginIntent(pickIntent, targetFromHit(activeHit));
        return;
      }
      if (activeHit) {
        chooseHit(activeHit);
      }
    }
  }

  function schedule(preset: KanbanFollowUpPreset) {
    if (!target) {
      return;
    }
    const due = kanbanFollowUpDue(preset, new Date(), customDate);
    if (!due) {
      setNotice("Choisissez une date de relance.");
      return;
    }
    const data = new FormData();
    data.set("companyId", target.companyId);
    if (target.opportunityId) {
      data.set("opportunityId", target.opportunityId);
    }
    data.set("dueAt", toDateTimeLocalValue(due));
    data.set("note", "Relance");
    startTransition(async () => {
      const result = await createFollowUp(idleActionResult, data);
      setNotice(result.message ?? (result.ok ? "Relance programmée." : "Impossible de programmer la relance."));
      if (result.ok) {
        setScreen("search");
      }
    });
  }

  const tooShort = query.trim().length > 0 && !isSearchableQuery(query) && (screen === "search" || screen === "pick-company");
  const waitingForResults =
    isSearchableQuery(query) && fetched.query !== normalizeSearchQuery(query);
  const noResults =
    isSearchableQuery(query) &&
    !pending &&
    !waitingForResults &&
    results.status === "ok" &&
    hits.length === 0 &&
    (screen === "search" || screen === "pick-company");

  return (
    <>
      <button
        type="button"
        className={cn("min-h-12", triggerClassName)}
        aria-label="Recherche globale"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPalette}
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
        onCancel={(event) => {
          const next = screenAfterEscape(screen);
          if (!next.close) {
            event.preventDefault();
            setScreen(next.screen);
            setNotice(null);
          }
        }}
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
                setActionIndex(0);
              }}
              placeholder={
                screen === "pick-company"
                  ? "Choisir une entreprise"
                  : screen === "search"
                    ? "Entreprises, opportunités, devis…"
                    : "Recherche en pause"
              }
              readOnly={screen !== "search" && screen !== "pick-company"}
              className="min-h-12 min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={hits.length > 0 || showingCommands}
              aria-controls={listId}
              aria-activedescendant={activeDescendant(listId, showingCommands, commands, hits, activeIndex)}
            />
            {pending || waitingForResults ? <span className="text-meta text-muted">Recherche…</span> : null}
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2">
          {notice ? <p className="px-2 py-2 text-meta text-muted" role="status">{notice}</p> : null}
          {results.status === "error" ? (
            <EmptyState title="Recherche indisponible" description="Réessayez dans un instant." />
          ) : null}
          {results.status === "unauthenticated" ? (
            <EmptyState title="Session requise" description="Reconnectez-vous pour chercher dans le CRM." />
          ) : null}
          {screen === "search" && query.trim() === "" ? (
            <CommandList
              listId={listId}
              commands={commands}
              activeIndex={activeIndex}
              onActive={setActiveIndex}
              onChoose={(command) => runCommand(command)}
            />
          ) : null}
          {screen === "stage" ? (
            <CommandList
              listId={listId}
              commands={commands}
              activeIndex={activeIndex}
              onActive={setActiveIndex}
              onChoose={(command) => runCommand(command)}
            />
          ) : null}
          {screen === "pick-company" && query.trim() === "" ? (
            <EmptyState title="Choisir une entreprise" description="Tapez au moins deux caractères, puis Entrée." />
          ) : null}
          {tooShort ? (
            <EmptyState title="Encore un caractère" description={`La recherche démarre à ${SEARCH_MIN_LENGTH} caractères.`} />
          ) : null}
          {noResults ? (
            <EmptyState title={`Aucun résultat pour « ${results.query || query.trim()} »`} description="Essayez un nom, un Instagram, une référence de devis." />
          ) : null}
          {hits.length > 0 && (screen === "search" || screen === "pick-company") && results.status === "ok" ? (
            <div id={listId} role="listbox" aria-label="Résultats de recherche">
              {results.groups.map((group) => {
                const groupHits = screen === "pick-company" ? group.hits.filter((hit) => hit.kind === "company") : group.hits;
                if (groupHits.length === 0) {
                  return null;
                }
                return (
                  <section key={group.kind} className="mb-2">
                    <h3 className="px-2 py-1.5 text-meta font-medium tracking-[0.08em] text-muted uppercase">
                      {SEARCH_KIND_LABELS[group.kind]}
                    </h3>
                    <ul className="flex flex-col gap-0.5">
                      {groupHits.map((hit) => {
                        const Icon = KIND_ICONS[hit.kind];
                        const flatIndex = hits.findIndex((item) => item.id === hit.id && item.kind === hit.kind);
                        const active = flatIndex === activeIndex;
                        const actions = active && screen === "search" ? contextualCommands(hit) : [];
                        return (
                          <li key={`${hit.kind}-${hit.id}`}>
                            <button
                              type="button"
                              id={`${listId}-hit-${hit.kind}-${hit.id}`}
                              role="option"
                              aria-selected={active}
                              className={cn(
                                "flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                                active ? "bg-primary/15 text-foreground" : "text-foreground hover:bg-surface-high",
                              )}
                              onMouseEnter={() => {
                                setActiveIndex(flatIndex);
                                setActionIndex(0);
                              }}
                              onClick={() => {
                                if (screen === "pick-company") {
                                  beginIntent(pickIntent, targetFromHit(hit));
                                  return;
                                }
                                chooseHit(hit);
                              }}
                            >
                              <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                              <span className="min-w-0">
                                <span className="block truncate text-body font-medium">{hit.title}</span>
                                {hit.subtitle ? (
                                  <span className="mt-0.5 block truncate text-meta text-muted">{hit.subtitle}</span>
                                ) : null}
                              </span>
                            </button>
                            {actions.length > 0 ? (
                              <div className="mt-1 flex flex-col gap-1 px-2 pb-2 sm:flex-row sm:flex-wrap">
                                {actions.map((command, index) => (
                                  <Button
                                    key={command.id}
                                    variant={index === actionIndex ? "primary" : "secondary"}
                                    className="min-h-12"
                                    onClick={() => runCommand(command, hit)}
                                  >
                                    {command.title}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              <p className="px-2 py-1 text-meta text-muted">{SEARCH_LIMIT_PER_KIND} résultats maximum par catégorie.</p>
            </div>
          ) : null}
          {screen === "interaction" && target ? (
            <QuickInteractionPanel
              companyId={target.companyId}
              opportunityId={target.opportunityId}
              onClose={() => setScreen("search")}
              onOpenFullForm={() => goTo(`/entreprises/${target.companyId}`)}
              onSaved={(message) => {
                setNotice(message);
                setScreen("search");
              }}
            />
          ) : null}
          {screen === "follow-up" && target ? (
            <div className="space-y-2 px-2 py-2">
              <p className="text-body text-foreground">Relance pour {target.companyName}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="secondary" className="min-h-12" disabled={pending} onClick={() => schedule("tomorrow")}>Demain</Button>
                <Button variant="secondary" className="min-h-12" disabled={pending} onClick={() => schedule("in3Days")}>Dans 3 jours</Button>
                <Button variant="secondary" className="min-h-12" disabled={pending} onClick={() => schedule("in1Week")}>Dans 1 semaine</Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  aria-label="Date de relance"
                  className="min-h-12 flex-1 rounded-xl border border-border bg-background px-3 text-body"
                />
                <Button variant="secondary" className="min-h-12" disabled={pending || !customDate} onClick={() => schedule("custom")}>
                  Cette date
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <p className="border-t border-border px-4 py-2 text-meta text-muted">↑↓ naviguer · Entrée valider · Échap revenir, puis fermer</p>
      </dialog>
      <CreateProspectDialog
        open={prospectOpen}
        onClose={() => setProspectOpen(false)}
        onCreated={() => setProspectOpen(false)}
      />
    </>
  );
}

function CommandList({
  listId,
  commands,
  activeIndex,
  onActive,
  onChoose,
}: {
  listId: string;
  commands: PaletteCommand[];
  activeIndex: number;
  onActive: (index: number) => void;
  onChoose: (command: PaletteCommand) => void;
}) {
  return (
    <div id={listId} role="listbox" aria-label="Commandes">
      <ul className="flex flex-col gap-0.5">
        {commands.map((command, index) => {
          const active = index === activeIndex;
          return (
            <li key={command.id}>
              <button
                type="button"
                id={`${listId}-cmd-${command.id}`}
                role="option"
                aria-selected={active}
                className={cn(
                  "flex min-h-12 w-full flex-col justify-center rounded-lg px-2.5 py-2 text-left",
                  active ? "bg-primary/15 text-foreground" : "text-foreground hover:bg-surface-high",
                )}
                onMouseEnter={() => onActive(index)}
                onClick={() => onChoose(command)}
              >
                <span className="text-body font-medium">{command.title}</span>
                <span className="text-meta text-muted">{command.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function targetFromHit(hit: SearchHit): Target {
  return {
    companyId: hit.companyId ?? hit.id,
    companyName: hit.title,
    opportunityId: hit.kind === "opportunity" ? (hit.opportunityId ?? hit.id) : null,
  };
}

function activeDescendant(
  listId: string,
  showingCommands: boolean,
  commands: PaletteCommand[],
  hits: SearchHit[],
  activeIndex: number,
) {
  if (showingCommands && commands[activeIndex]) {
    return `${listId}-cmd-${commands[activeIndex].id}`;
  }
  const hit = hits[activeIndex];
  return hit ? `${listId}-hit-${hit.kind}-${hit.id}` : undefined;
}
