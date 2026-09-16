"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClassName } from "@/components/ui/field";
import { formatDate, formatMoney } from "@/lib/crm/form-data";
import type { ClientListItem } from "@/lib/queries/clients";
import { cn } from "@/lib/cn";

type ClientExplorerProps = {
  clients: ClientListItem[];
};

function contactLabel(client: ClientListItem) {
  if (!client.primaryContact) {
    return "—";
  }
  return `${client.primaryContact.firstName} ${client.primaryContact.lastName}`;
}

export function ClientExplorer({ clients }: ClientExplorerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return clients;
    }

    return clients.filter((client) => {
      const haystack = [client.name, client.industry, client.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [clients, query]);

  if (clients.length === 0) {
    return (
      <Card className="px-5">
        <EmptyState
          title="Aucun client"
          description="Les entreprises passent ici après l'acceptation d'un devis."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <label className="relative block max-w-xl">
          <span className="sr-only">Rechercher</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, secteur, ville"
            className={cn(controlClassName, "pl-9")}
          />
        </label>
      </Card>

      {filtered.length === 0 ? (
        <Card className="px-5">
          <EmptyState title="Aucun résultat" description="Aucun client ne correspond à la recherche." />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((client) => (
              <Link
                key={client.id}
                href={`/entreprises/${client.id}`}
                className="foil-subtle rounded-card card-sheen border border-border bg-surface p-4"
              >
                <p className="truncate font-medium text-foreground">{client.name}</p>
                <p className="mt-1 text-meta text-muted">
                  {[client.industry, client.city].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-3 font-sans text-body tabular-nums text-foreground">
                  {formatMoney(client.signedRevenue)}
                </p>
              </Link>
            ))}
          </div>

          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-body">
                <thead className="border-b border-border bg-surface-high/60 text-meta tracking-[0.08em] text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Secteur</th>
                    <th className="px-4 py-3 font-medium">Ville</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">CA signé</th>
                    <th className="px-4 py-3 font-medium">Projet actif</th>
                    <th className="px-4 py-3 font-medium">Prochaine échéance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr
                      key={client.id}
                      className="relative border-b border-border/70 last:border-0 hover:bg-surface-high/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/entreprises/${client.id}`}
                          className="font-medium text-foreground after:absolute after:inset-0"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{client.industry ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{client.city ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{contactLabel(client)}</td>
                      <td className="px-4 py-3 font-sans tabular-nums text-foreground">
                        {formatMoney(client.signedRevenue)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {client.activeProject?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {client.nextDeadline ? formatDate(client.nextDeadline) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
