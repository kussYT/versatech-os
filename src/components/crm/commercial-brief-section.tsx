"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { updateCommercialBrief } from "@/actions/brief";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  BRIEF_VERIFICATION_LABELS,
  BRIEF_VERIFICATION_STATUSES,
  type CommercialBrief,
} from "@/lib/prospection/brief";
import { cn } from "@/lib/cn";

type CommercialBriefSectionProps = {
  companyId: string;
  industry: string | null;
  description: string | null;
  website: string | null;
  brief: CommercialBrief;
};

export function CommercialBriefSection({
  companyId,
  industry,
  description,
  website,
  brief,
}: CommercialBriefSectionProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCommercialBrief, idleActionResult);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section text-foreground">Brief commercial</h2>
        <Button size="sm" variant="secondary" onClick={() => setEditing((value) => !value)}>
          {editing ? "Fermer" : "Modifier"}
        </Button>
      </div>

      {state.ok ? (
        <p className="mt-3 text-meta text-success">Brief enregistré.</p>
      ) : null}

      {state.message && !state.ok ? (
        <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      {editing ? (
        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="companyId" value={companyId} />
          <BriefBlock title="Entreprise">
            <p className="text-meta text-muted">Catégorie : {industry || "—"}</p>
            <p className="mt-1 whitespace-pre-wrap text-body text-muted">{description || "—"}</p>
            <p className="mt-2 text-meta text-faint">Modifiable dans la fiche (secteur / notes).</p>
          </BriefBlock>
          <Field label="Présence numérique" htmlFor="brief-digital">
            <textarea
              id="brief-digital"
              name="digitalPresence"
              rows={3}
              defaultValue={brief.digitalPresence}
              disabled={pending}
              className={cn(controlClassName, "min-h-20 resize-y")}
            />
          </Field>
          <Field label="Points forts" htmlFor="brief-strengths">
            <textarea
              id="brief-strengths"
              name="strengths"
              rows={3}
              defaultValue={brief.strengths}
              disabled={pending}
              className={cn(controlClassName, "min-h-20 resize-y")}
            />
          </Field>
          <Field label="Opportunités" htmlFor="brief-opportunities">
            <textarea
              id="brief-opportunities"
              name="opportunities"
              rows={3}
              defaultValue={brief.opportunities}
              disabled={pending}
              className={cn(controlClassName, "min-h-20 resize-y")}
            />
          </Field>
          <Field label="Ce que VersaTech peut proposer" htmlFor="brief-proposal">
            <textarea
              id="brief-proposal"
              name="proposal"
              rows={3}
              defaultValue={brief.proposal}
              disabled={pending}
              className={cn(controlClassName, "min-h-20 resize-y")}
            />
          </Field>
          <Field label="Angle d'approche" htmlFor="brief-angle">
            <textarea
              id="brief-angle"
              name="angle"
              rows={3}
              defaultValue={brief.angle}
              disabled={pending}
              className={cn(controlClassName, "min-h-20 resize-y")}
            />
          </Field>
          <Field label="Vérification des infos" htmlFor="brief-verification">
            <select
              id="brief-verification"
              name="verificationStatus"
              defaultValue={brief.verificationStatus}
              disabled={pending}
              className={controlClassName}
            >
              {BRIEF_VERIFICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {BRIEF_VERIFICATION_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer le brief"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          <BriefBlock title="Entreprise">
            <p className="text-body text-foreground">{industry || "Catégorie à compléter"}</p>
            <p className="mt-1 whitespace-pre-wrap text-muted">{description || "Description à compléter"}</p>
          </BriefBlock>
          <BriefBlock title="Présence numérique">
            {website ? (
              <a href={website} className="break-all text-primary hover:text-primary-hover" target="_blank" rel="noreferrer">
                {website}
              </a>
            ) : (
              <p className="text-muted">Site non renseigné</p>
            )}
            <p className="mt-2 whitespace-pre-wrap text-muted">
              {brief.digitalPresence || "Présence digitale observée à compléter"}
            </p>
          </BriefBlock>
          <BriefBlock title="Points forts">
            <p className="whitespace-pre-wrap text-muted">{brief.strengths || "—"}</p>
          </BriefBlock>
          <BriefBlock title="Opportunités">
            <p className="whitespace-pre-wrap text-muted">{brief.opportunities || "—"}</p>
          </BriefBlock>
          <BriefBlock title="Ce que VersaTech peut proposer">
            <p className="whitespace-pre-wrap text-muted">{brief.proposal || "—"}</p>
          </BriefBlock>
          <BriefBlock title="Angle d'approche">
            <p className="whitespace-pre-wrap text-muted">{brief.angle || "—"}</p>
          </BriefBlock>
          <p className="text-meta text-faint">
            Infos {BRIEF_VERIFICATION_LABELS[brief.verificationStatus]}
          </p>
        </div>
      )}
    </Card>
  );
}

function BriefBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-meta font-semibold tracking-[0.12em] text-muted uppercase">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}
