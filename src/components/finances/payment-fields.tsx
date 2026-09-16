"use client";

import { useMemo, useState } from "react";
import { Field, controlClassName } from "@/components/ui/field";
import { PAYMENT_STATUS_LABELS } from "@/lib/crm/constants";
import { CREATE_PAYMENT_STATUSES } from "@/lib/finance";
import { formatMoney, toDateInputValue } from "@/lib/crm/form-data";
import type { PaymentFormOptions } from "@/lib/queries/payments";

type PaymentFieldsProps = {
  pending: boolean;
  firstError: (key: string) => string | undefined;
  options: PaymentFormOptions;
  defaultCompanyId?: string;
  defaultProjectId?: string;
  defaultQuoteId?: string;
  lockCompany?: boolean;
  lockProject?: boolean;
};

export function PaymentFields({
  pending,
  firstError,
  options,
  defaultCompanyId,
  defaultProjectId,
  defaultQuoteId,
  lockCompany = false,
  lockProject = false,
}: PaymentFieldsProps) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [quoteId, setQuoteId] = useState(defaultQuoteId ?? "");
  const [status, setStatus] = useState<(typeof CREATE_PAYMENT_STATUSES)[number]>("PENDING");

  const quotes = useMemo(
    () => options.quotes.filter((quote) => !companyId || quote.companyId === companyId),
    [companyId, options.quotes],
  );
  const projects = useMemo(
    () => options.projects.filter((project) => !companyId || project.companyId === companyId),
    [companyId, options.projects],
  );
  const selectedQuote = quotes.find((quote) => quote.id === quoteId) ?? null;

  return (
    <>
      {lockCompany ? (
        <input type="hidden" name="companyId" value={companyId} />
      ) : (
        <Field label="Entreprise" htmlFor="payment-company" error={firstError("companyId")}>
          <select
            id="payment-company"
            name="companyId"
            required
            disabled={pending}
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setQuoteId("");
              setProjectId("");
            }}
            className={controlClassName}
          >
            <option value="">Choisir…</option>
            {options.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="Devis accepté"
        htmlFor="payment-quote"
        hint={
          selectedQuote
            ? `TTC ${formatMoney(selectedQuote.amountIncTax)} · restant ${formatMoney(selectedQuote.remaining)}`
            : "Optionnel — uniquement les devis ACCEPTED"
        }
        error={firstError("quoteId")}
      >
        <select
          id="payment-quote"
          name="quoteId"
          disabled={pending || !companyId}
          value={quoteId}
          onChange={(event) => {
            const nextQuoteId = event.target.value;
            setQuoteId(nextQuoteId);
            const quote = quotes.find((item) => item.id === nextQuoteId);
            if (quote?.projectId && !lockProject) {
              setProjectId(quote.projectId);
            }
          }}
          className={controlClassName}
        >
          <option value="">Aucun</option>
          {quotes.map((quote) => (
            <option key={quote.id} value={quote.id}>
              {quote.reference} · {formatMoney(quote.amountIncTax)}
            </option>
          ))}
        </select>
      </Field>

      {lockProject ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : (
        <Field label="Projet" htmlFor="payment-project" hint="Optionnel" error={firstError("projectId")}>
          <select
            id="payment-project"
            name="projectId"
            disabled={pending || !companyId}
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={controlClassName}
          >
            <option value="">Aucun</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Libellé" htmlFor="payment-label" error={firstError("label")}>
        <input
          id="payment-label"
          name="label"
          required
          disabled={pending}
          placeholder="Acompte 40%, solde, facture…"
          className={controlClassName}
        />
      </Field>

      <Field label="Montant TTC" htmlFor="payment-amount" hint="En euros" error={firstError("amount")}>
        <input
          id="payment-amount"
          name="amount"
          inputMode="decimal"
          required
          disabled={pending}
          placeholder={selectedQuote ? selectedQuote.remaining : "3200"}
          className={controlClassName}
        />
      </Field>

      <Field label="Statut" htmlFor="payment-status" error={firstError("status")}>
        <select
          id="payment-status"
          name="status"
          required
          disabled={pending}
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as (typeof CREATE_PAYMENT_STATUSES)[number])
          }
          className={controlClassName}
        >
          {CREATE_PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PAYMENT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Échéance"
        htmlFor="payment-due"
        hint="Si dépassée, le paiement passe en retard"
        error={firstError("dueAt")}
      >
        <input
          id="payment-due"
          name="dueAt"
          type="date"
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      {status === "PAID" ? (
        <Field label="Date d'encaissement" htmlFor="payment-paid" error={firstError("paidAt")}>
          <input
            id="payment-paid"
            name="paidAt"
            type="date"
            disabled={pending}
            defaultValue={toDateInputValue(new Date())}
            className={controlClassName}
          />
        </Field>
      ) : null}

      <Field
        label="Référence externe"
        htmlFor="payment-reference"
        hint="Optionnel — n° virement, facture…"
        error={firstError("externalReference")}
      >
        <input
          id="payment-reference"
          name="externalReference"
          disabled={pending}
          placeholder="VIR-2026-014"
          className={controlClassName}
        />
      </Field>
    </>
  );
}
