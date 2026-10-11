"use client";

import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  FolderKanban,
  Kanban,
  Plus,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { useProspectComposer } from "@/components/crm/prospect-composer";
import { useDismissibleMenu } from "@/components/layout/use-dismissible-menu";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";

type QuickCreateLink = {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
};

/** Destinations réelles où la création se fait avec les formulaires existants. */
const QUICK_CREATE_LINKS: readonly QuickCreateLink[] = [
  {
    label: "Opportunité",
    hint: "Depuis une fiche entreprise",
    href: "/entreprises",
    icon: Kanban,
  },
  { label: "Devis", hint: "Page Devis", href: "/devis", icon: Receipt },
  { label: "Projet", hint: "Page Projets", href: "/projets", icon: FolderKanban },
  { label: "Tâche", hint: "Page Tâches", href: "/taches", icon: CheckSquare },
  {
    label: "Rendez-vous",
    hint: "Calendrier · Nouvel événement",
    href: "/calendrier",
    icon: CalendarPlus,
  },
];

const ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-body text-foreground transition-colors duration-hover hover:bg-primary/10 focus-visible:bg-primary/10";

type QuickCreateMenuProps = {
  className?: string;
};

export function QuickCreateMenu({ className }: QuickCreateMenuProps) {
  const { open, close, toggle, containerRef } = useDismissibleMenu();
  const { openComposer } = useProspectComposer();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "primary", shape: "pill" }),
          "h-10 gap-1.5 px-3.5 sm:px-4 shadow-[0_4px_14px_rgb(0_122_255/0.28)]",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Créer"
        onClick={toggle}
      >
        <Plus className="size-4" aria-hidden="true" strokeWidth={2.25} />
        <span className="text-body font-semibold">Nouveau</span>
        <ChevronDown className="hidden size-3.5 opacity-90 sm:block" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Créer"
          className="glass-panel absolute right-0 z-40 mt-2 w-64 rounded-2xl p-1.5"
        >
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={() => {
              close();
              openComposer();
            }}
          >
            <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-medium">Entreprise</span>
              <span className="block text-meta text-muted">Nouveau prospect</span>
            </span>
          </button>
          {QUICK_CREATE_LINKS.map(({ label, hint, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className={ITEM_CLASS}
              onClick={close}
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                <span className="block text-meta text-muted">{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
