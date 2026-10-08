"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { updateOpportunityStage } from "@/actions/opportunities";
import { fetchKanbanPage, fetchOpportunityQuickView } from "@/actions/kanban";
import { KanbanCard, KanbanCardPreview } from "@/components/pipeline/opportunity-card";
import { OpportunityQuickView } from "@/components/pipeline/opportunity-quick-view";
import { PipelineDrawer } from "@/components/pipeline/pipeline-drawer";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { formatMoney } from "@/lib/crm/form-data";
import {
  acceptMove,
  cancelConfirmation,
  cardMatchesQuery,
  createMoves,
  hiddenCardCount,
  openEstimatedValue,
  rejectMove,
  requestStageChange,
  setLostReason,
  shiftColumnTallies,
  stagesForFilter,
  storeConfirmationToken,
  type ColumnTally,
  type KanbanFilter,
  type KanbanMoves,
} from "@/lib/pipeline/kanban";
import type { KanbanBoardLoad, PipelineOpportunityCard } from "@/lib/queries/opportunities";
import type { OpportunityStage } from "@/generated/prisma/client";

const FILTERS: { id: KanbanFilter; label: string }[] = [
  { id: "active", label: "Actives" },
  { id: "all", label: "Toutes" },
  { id: "won", label: "Gagnées" },
  { id: "lost", label: "Perdues" },
];

type PipelineBoardProps = {
  board: KanbanBoardLoad;
};

export function PipelineBoard({ board }: PipelineBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const [filter, setFilter] = useState<KanbanFilter>("active");
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<Partial<Record<OpportunityStage, PipelineOpportunityCard[]>>>({});
  const [followUps, setFollowUps] = useState<Record<string, { title: string; dueAt: string }>>({});
  const [tallies, setTallies] = useState<ColumnTally[]>(() => toTallies(board));
  const [moves, setMoves] = useState<KanbanMoves>(() => createMoves(flatten(board, {})));
  const [seen, setSeen] = useState(() => boardSignature(board));
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [quick, setQuick] = useState<Awaited<ReturnType<typeof fetchOpportunityQuickView>>>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const signature = boardSignature(board);
  const locked = moves.cards.some((card) => card.lock);
  if (!locked && signature !== seen) {
    setSeen(signature);
    setTallies(toTallies(board));
    setExtra({});
    setMoves(createMoves(flatten(board, {})));
  }

  const cards = decorate(flatten(board, extra), moves, followUps);
  const visibleStages = stagesForFilter(filter);
  const dragging = cards.find((card) => card.id === draggingId) ?? null;
  const confirming = moves.cards.find((card) => card.lock?.kind === "confirm") ?? null;
  const confirmingCard = confirming ? cards.find((card) => card.id === confirming.id) ?? null : null;
  const confirmationInDrawer = openId !== null && confirming?.id === openId;

  function openCard(opportunityId: string) {
    setOpenId(opportunityId);
    setQuick(null);
    setQuickError(null);
    setQuickLoading(true);
    startTransition(async () => {
      const result = await fetchOpportunityQuickView(opportunityId);
      setQuickLoading(false);
      if (!result) {
        setQuickError("Opportunité introuvable.");
        return;
      }
      setQuick(result);
    });
  }

  function changeStage(opportunityId: string, to: OpportunityStage) {
    const card = cards.find((item) => item.id === opportunityId);
    if (!card) {
      return;
    }
    const result = requestStageChange(moves, opportunityId, to);
    if (result.status === "blocked") {
      setNotice("Cette carte est déjà en cours de mise à jour.");
      return;
    }
    if (result.status !== "submit" && result.status !== "confirm") {
      return;
    }
    setMoves(result.state);
    if (result.status === "confirm") {
      return;
    }
    const from = card.stage;
    setTallies((current) => shiftColumnTallies(current, from, to, card.estimatedValue));
    submitMove(opportunityId, to, "", null, result.generation, from, card.estimatedValue);
  }

  function submitMove(
    opportunityId: string,
    stage: OpportunityStage,
    lostReason: string,
    confirmationToken: string | null,
    generation: number,
    from: OpportunityStage,
    estimatedValue: string,
  ) {
    const data = new FormData();
    data.set("opportunityId", opportunityId);
    data.set("stage", stage);
    data.set("lostReason", lostReason);
    if (confirmationToken) {
      data.set("confirmationToken", confirmationToken);
    }
    startTransition(async () => {
      const response = await updateOpportunityStage(idleActionResult, data);
      if (response.ok) {
        setMoves((current) => acceptMove(current, opportunityId, generation));
        if (stage === "WON" || stage === "LOST") {
          setTallies((current) => shiftColumnTallies(current, from, stage, estimatedValue));
        }
        setNotice(response.message ?? "Étape mise à jour.");
        return;
      }
      if (response.data?.confirmationToken && (stage === "WON" || stage === "LOST") && !confirmationToken) {
        setMoves((current) => storeConfirmationToken(current, opportunityId, generation, response.data?.confirmationToken ?? ""));
        setNotice(response.message ?? "Confirmation requise.");
        return;
      }
      setMoves((current) => rejectMove(current, opportunityId, generation, response.message ?? "Impossible de changer l'étape."));
      if (stage !== "WON" && stage !== "LOST") {
        setTallies((current) => shiftColumnTallies(current, stage, from, estimatedValue));
      }
      setNotice(response.message ?? "Impossible de changer l'étape.");
    });
  }

  function confirmSensitive() {
    if (!confirming?.lock || confirming.lock.kind !== "confirm" || !confirmingCard) {
      return;
    }
    const { to, generation, lostReason, token, from } = confirming.lock;
    if (to === "LOST" && lostReason.trim() === "") {
      setNotice("Indiquez une raison avant de confirmer.");
      return;
    }
    if (!token) {
      submitMove(confirming.id, to, lostReason, null, generation, from, confirmingCard.estimatedValue);
      return;
    }
    submitMove(confirming.id, to, lostReason, token, generation, from, confirmingCard.estimatedValue);
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const opportunityId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!isStage(overId)) {
      return;
    }
    changeStage(opportunityId, overId);
  }

  async function loadMore(stage: OpportunityStage) {
    const column = board.columns.find((item) => item.stage === stage);
    const loaded = (column?.opportunities.length ?? 0) + (extra[stage]?.length ?? 0);
    const page = await fetchKanbanPage(stage, loaded);
    setExtra((current) => ({
      ...current,
      [stage]: [...(current[stage] ?? []), ...page],
    }));
    setMoves((current) => {
      const known = new Set(current.cards.map((card) => card.id));
      return {
        ...current,
        cards: [
          ...current.cards,
          ...page.filter((card) => !known.has(card.id)).map((card) => ({
            id: card.id,
            stage: card.stage,
            generation: 0,
            lock: null,
          })),
        ],
      };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer le pipeline">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              variant={filter === item.id ? "primary" : "secondary"}
              className="min-h-12 px-4"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <label className="block min-w-0 flex-1 text-meta text-muted sm:max-w-xs">
          Recherche
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Entreprise ou titre"
            className="mt-1 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-body text-foreground"
          />
        </label>
      </div>
      <p className="text-meta text-muted">
        Étapes ouvertes : {formatMoney(openEstimatedValue(tallies))} estimés
      </p>
      {notice ? (
        <p className="text-meta text-muted" role="status">{notice}</p>
      ) : null}
      {confirming?.lock && confirming.lock.kind === "confirm" && confirmingCard && !confirmationInDrawer ? (
        <StageConfirmation
          companyName={confirmingCard.company.name}
          stageLabel={OPPORTUNITY_STAGE_LABELS[confirming.lock.to]}
          lost={confirming.lock.to === "LOST"}
          lostReason={confirming.lock.lostReason}
          hasToken={Boolean(confirming.lock.token)}
          onReason={(value) => setMoves((current) => setLostReason(current, confirming.id, value))}
          onConfirm={confirmSensitive}
          onCancel={() => {
            setMoves((current) => cancelConfirmation(current, confirming.id));
            setNotice("Changement annulé.");
          }}
        />
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={(event) => setDraggingId(String(event.active.id))}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex snap-x gap-3 overflow-x-auto pb-3">
          {board.columns
            .filter((column) => visibleStages.includes(column.stage))
            .map((column) => {
              const tally = tallies.find((item) => item.stage === column.stage) ?? {
                stage: column.stage,
                count: column.count,
                estimatedValue: column.estimatedValue,
              };
              const columnCards = cards.filter(
                (card) => card.stage === column.stage && cardMatchesQuery(
                  { companyName: card.company.name, title: card.title },
                  query,
                ),
              );
              const hidden = hiddenCardCount(tally.count, cards.filter((card) => card.stage === column.stage).length);
              return (
                <KanbanColumn
                  key={column.stage}
                  stage={column.stage}
                  count={tally.count}
                  estimatedValue={tally.estimatedValue}
                  shown={columnCards.length}
                  searching={query.trim() !== ""}
                  hidden={hidden}
                  onMore={() => void loadMore(column.stage)}
                >
                  {columnCards.map((card) => (
                    <KanbanCard
                      key={card.id}
                      opportunity={card}
                      locked={Boolean(moves.cards.find((item) => item.id === card.id)?.lock)}
                      onOpen={() => openCard(card.id)}
                      onStage={(stage) => changeStage(card.id, stage)}
                    />
                  ))}
                </KanbanColumn>
              );
            })}
        </div>
        <DragOverlay>{dragging ? <KanbanCardPreview opportunity={dragging} /> : null}</DragOverlay>
      </DndContext>

      <PipelineDrawer
        open={openId !== null}
        title={quick?.company.name ?? "Aperçu"}
        onClose={() => setOpenId(null)}
      >
        {confirmationInDrawer && confirming?.lock && confirming.lock.kind === "confirm" && confirmingCard ? (
          <div className="mb-4">
            <StageConfirmation
              companyName={confirmingCard.company.name}
              stageLabel={OPPORTUNITY_STAGE_LABELS[confirming.lock.to]}
              lost={confirming.lock.to === "LOST"}
              lostReason={confirming.lock.lostReason}
              hasToken={Boolean(confirming.lock.token)}
              onReason={(value) => setMoves((current) => setLostReason(current, confirming.id, value))}
              onConfirm={confirmSensitive}
              onCancel={() => {
                setMoves((current) => cancelConfirmation(current, confirming.id));
                setNotice("Changement annulé.");
              }}
            />
          </div>
        ) : null}
        {openId ? (
          <OpportunityQuickView
            view={quick}
            currentStage={cards.find((card) => card.id === openId)?.stage ?? quick?.stage ?? "TO_QUALIFY"}
            loading={quickLoading}
            error={quickError}
            onStage={(stage) => changeStage(openId, stage)}
            onFollowUp={(followUp) => setFollowUps((current) => ({ ...current, [openId]: followUp }))}
            onReload={() => openCard(openId)}
          />
        ) : null}
      </PipelineDrawer>
    </div>
  );
}

function StageConfirmation({
  companyName,
  stageLabel,
  lost,
  lostReason,
  hasToken,
  onReason,
  onConfirm,
  onCancel,
}: {
  companyName: string;
  stageLabel: string;
  lost: boolean;
  lostReason: string;
  hasToken: boolean;
  onReason: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4" role="dialog" aria-label="Confirmer l'étape">
      <p className="text-body text-foreground">
        {companyName} — passer en {stageLabel} ?
      </p>
      {lost ? (
        <label className="mt-3 block text-meta text-muted">
          Raison
          <input
            value={lostReason}
            onChange={(event) => onReason(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-body"
          />
        </label>
      ) : (
        <p className="mt-2 text-meta text-muted">L’entreprise devient cliente si elle ne l’est pas déjà.</p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button className="min-h-12" onClick={onConfirm}>
          {hasToken ? "Confirmer" : "Demander la confirmation"}
        </Button>
        <Button variant="secondary" className="min-h-12" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  count,
  estimatedValue,
  shown,
  searching,
  hidden,
  onMore,
  children,
}: {
  stage: OpportunityStage;
  count: number;
  estimatedValue: string;
  shown: number;
  searching: boolean;
  hidden: number;
  onMore: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`pipeline-${stage}`}
      className={`flex w-[85vw] max-w-[17.5rem] shrink-0 snap-start flex-col rounded-xl border bg-background/90 p-3 sm:w-[17.5rem] ${isOver ? "border-primary" : "border-border"}`}
    >
      <h2 id={`pipeline-${stage}`} className="text-body font-medium text-foreground">
        {OPPORTUNITY_STAGE_LABELS[stage]}
      </h2>
      <p className="mt-1 text-meta text-muted">
        {count} {count > 1 ? "opportunités" : "opportunité"}
      </p>
      <p className="text-meta text-muted">{formatMoney(estimatedValue)} estimés</p>
      {searching ? (
        <p className="mt-1 text-meta text-muted">
          Parmi les cartes chargées : {shown} affichée{shown > 1 ? "s" : ""}.
        </p>
      ) : null}
      <div className="mt-3 flex min-h-24 flex-col gap-2">{children}</div>
      {hidden > 0 ? (
        <Button variant="secondary" className="mt-3 min-h-12" onClick={onMore}>
          {hidden} non chargée{hidden > 1 ? "s" : ""} — afficher
        </Button>
      ) : null}
    </section>
  );
}

function decorate(
  cards: PipelineOpportunityCard[],
  moves: KanbanMoves,
  followUps: Record<string, { title: string; dueAt: string }>,
) {
  const stages = new Map(moves.cards.map((card) => [card.id, card.stage]));
  return cards.map((card) => ({
    ...card,
    stage: stages.get(card.id) ?? card.stage,
    nextFollowUp: followUps[card.id] ?? card.nextFollowUp,
  }));
}

function flatten(
  board: KanbanBoardLoad,
  extra: Partial<Record<OpportunityStage, PipelineOpportunityCard[]>>,
) {
  return board.columns.flatMap((column) => [...column.opportunities, ...(extra[column.stage] ?? [])]);
}

function toTallies(board: KanbanBoardLoad): ColumnTally[] {
  return board.columns.map((column) => ({
    stage: column.stage,
    count: column.count,
    estimatedValue: column.estimatedValue,
  }));
}

function boardSignature(board: KanbanBoardLoad) {
  return board.columns
    .map((column) => `${column.stage}:${column.count}:${column.opportunities.map((card) => `${card.id}:${card.stage}`).join(",")}`)
    .join("|");
}

function isStage(value: string): value is OpportunityStage {
  return (OPPORTUNITY_STAGES as readonly string[]).includes(value);
}
