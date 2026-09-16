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
    id: "commercial",
    label: "Commercial",
    items: [
      { href: "/prospection", label: "Prospection", icon: "prospection" },
      { href: "/carte", label: "Carte", icon: "map" },
      { href: "/tournee", label: "Tournée", icon: "tour" },
      { href: "/entreprises", label: "Entreprises", icon: "companies" },
      { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/relances", label: "Relances", icon: "followups" },
    ],
  },
  {
    id: "travail",
    label: "Travail",
    items: [
      { href: "/projets", label: "Projets", icon: "projects" },
      { href: "/taches", label: "Tâches", icon: "tasks" },
      { href: "/calendrier", label: "Calendrier", icon: "calendar" },
      { href: "/github", label: "GitHub", icon: "github" },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { href: "/clients", label: "Clients", icon: "clients" },
      { href: "/devis", label: "Devis", icon: "quotes" },
      { href: "/maintenance", label: "Maintenance", icon: "maintenance" },
      { href: "/finances", label: "Finances", icon: "finance" },
      { href: "/documents", label: "Documents", icon: "documents" },
    ],
  },
  {
    id: "analyse",
    label: "Analyse",
    items: [{ href: "/analytics", label: "Analytics", icon: "analytics" }],
  },
];

export const settingsItem: NavItemConfig = {
  href: "/parametres",
  label: "Paramètres",
  icon: "settings",
};

export const mobileTabItems: NavItemConfig[] = [
  todayItem,
  { href: "/prospection", label: "Prospection", icon: "prospection" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/taches", label: "Tâches", icon: "tasks" },
];

export function isNavActive(pathname: string, href: NavHref) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
