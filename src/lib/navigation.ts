export type NavHref =
  | "/"
  | "/prospection"
  | "/carte"
  | "/tournee"
  | "/entreprises"
  | "/pipeline"
  | "/relances"
  | "/projets"
  | "/taches"
  | "/calendrier"
  | "/github"
  | "/clients"
  | "/devis"
  | "/maintenance"
  | "/finances"
  | "/documents"
  | "/analytics"
  | "/parametres";

export type NavIconName =
  | "today"
  | "prospection"
  | "map"
  | "tour"
  | "companies"
  | "pipeline"
  | "followups"
  | "projects"
  | "tasks"
  | "calendar"
  | "github"
  | "clients"
  | "quotes"
  | "maintenance"
  | "finance"
  | "documents"
  | "analytics"
  | "settings";

export type NavItemConfig = {
  href: NavHref;
  label: string;
  icon: NavIconName;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItemConfig[];
};

export const todayItem: NavItemConfig = {
  href: "/",
  label: "Aujourd'hui",
  icon: "today",
};

export const navSections: NavSection[] = [
  {
    id: "quotidien",
    label: "Quotidien",
    items: [
      { href: "/entreprises", label: "Entreprises", icon: "companies" },
      { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/relances", label: "Relances", icon: "followups" },
      { href: "/projets", label: "Projets", icon: "projects" },
    ],
  },
  {
    id: "terrain",
    label: "Terrain",
    items: [
      { href: "/prospection", label: "Prospection", icon: "prospection" },
      { href: "/tournee", label: "Tournée", icon: "tour" },
      { href: "/carte", label: "Carte", icon: "map" },
    ],
  },
  {
    id: "dossier",
    label: "Dossier",
    items: [
      { href: "/devis", label: "Devis", icon: "quotes" },
      { href: "/documents", label: "Documents", icon: "documents" },
      { href: "/maintenance", label: "Maintenance", icon: "maintenance" },
      { href: "/finances", label: "Finances", icon: "finance" },
      { href: "/taches", label: "Tâches", icon: "tasks" },
      { href: "/calendrier", label: "Calendrier", icon: "calendar" },
    ],
  },
];

/** Pages utiles, hors du parcours du jour. */
export const secondaryNavSections: NavSection[] = [
  {
    id: "plus",
    label: "Plus",
    items: [
      { href: "/clients", label: "Clients", icon: "clients" },
      { href: "/github", label: "GitHub", icon: "github" },
      { href: "/analytics", label: "Analytics", icon: "analytics" },
    ],
  },
];

export const settingsItem: NavItemConfig = {
  href: "/parametres",
  label: "Paramètres",
  icon: "settings",
};

export const mobileTabItems: NavItemConfig[] = [
  todayItem,
  { href: "/entreprises", label: "Entreprises", icon: "companies" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/projets", label: "Projets", icon: "projects" },
];

export function isNavActive(pathname: string, href: NavHref) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
