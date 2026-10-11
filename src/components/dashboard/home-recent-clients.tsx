import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/crm/form-data";
import type { DashboardRecentClient } from "@/lib/queries/dashboard-home";

type HomeRecentClientsProps = {
  clients: DashboardRecentClient[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function HomeRecentClients({ clients }: HomeRecentClientsProps) {
  return (
    <section className="glass-card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section text-foreground">Derniers clients</h2>
        <Link href="/clients" className="text-meta font-medium text-primary hover:text-primary-hover">
          Voir tout →
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-white/40 px-3 py-8 text-center">
          <p className="text-body font-medium text-foreground">Aucun client récent</p>
          <p className="mt-1 text-meta text-muted">Les entreprises au statut Client apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="mt-4 flex-1 space-y-2">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/entreprises/${client.id}`}
                className="flex items-center gap-3 rounded-2xl px-1.5 py-2 transition-colors duration-hover hover:bg-white/55"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-meta font-semibold text-primary">
                  {initials(client.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-foreground">{client.name}</p>
                  <p className="truncate text-meta text-muted">
                    {client.principalProjectName ?? "Sans projet principal"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-meta font-medium tabular-nums text-foreground">
                    {formatMoney(client.collected)}
                  </p>
                  <p className="text-meta text-faint">{formatDate(client.updatedAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
