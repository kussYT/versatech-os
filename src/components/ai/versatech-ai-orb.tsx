"use client";

import { cn } from "@/lib/cn";
import { useVersatechAi } from "@/components/ai/versatech-ai";

export function VersatechAiOrb() {
  const { open, togglePanel, status } = useVersatechAi();
  const thinking = status === "thinking";

  return (
    <button
      type="button"
      className={cn("vt-ai-orb", thinking && "vt-ai-orb-thinking")}
      aria-label={open ? "Fermer VersaTech AI" : "Ouvrir VersaTech AI"}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls="versatech-ai-panel"
      onClick={togglePanel}
    >
      <span className="vt-ai-orb-core" aria-hidden="true">
        ✦
      </span>
    </button>
  );
}
