import { createElement } from "react";
import {
  Building2,
  CalendarDays,
  ChartColumn,
  FileText,
  Files,
  FolderKanban,
  GitBranch,
  Handshake,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Map,
  Phone,
  RotateCcw,
  Route,
  Settings,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NavIconName } from "@/lib/navigation";

const icons: Record<NavIconName, LucideIcon> = {
  today: LayoutDashboard,
  prospection: Phone,
  map: Map,
  tour: Route,
  companies: Building2,
  pipeline: Kanban,
  followups: RotateCcw,
  projects: FolderKanban,
  tasks: ListTodo,
  calendar: CalendarDays,
  github: GitBranch,
  clients: Handshake,
  quotes: FileText,
  maintenance: Wrench,
  finance: Wallet,
  documents: Files,
  analytics: ChartColumn,
  settings: Settings,
};

type NavIconProps = {
  name: NavIconName;
  className?: string;
};

export function NavIcon({ name, className }: NavIconProps) {
  return createElement(icons[name], {
    className,
    "aria-hidden": true,
  });
}
