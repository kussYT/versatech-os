"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useVersatechChat, type ChatMessage, type ChatStatus } from "@/components/ai/use-versatech-chat";

type VersatechAiContextValue = {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  draft: string;
  setDraft: (value: string) => void;
  send: (raw?: string) => Promise<void>;
  canSend: boolean;
  confirmProposal: (messageId: string) => Promise<void>;
  cancelProposal: (messageId: string) => void;
  confirmingId: string | null;
  activityLabel: string | null;
};

const VersatechAiContext = createContext<VersatechAiContextValue | null>(null);

export function VersatechAiProvider({ children }: { children: ReactNode }) {
  const chat = useVersatechChat();
  const [open, setOpen] = useState(false);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = useCallback(() => setOpen((current) => !current), []);

  return (
    <VersatechAiContext.Provider
      value={{
        ...chat,
        open,
        openPanel,
        closePanel,
        togglePanel,
      }}
    >
      {children}
    </VersatechAiContext.Provider>
  );
}

export function useVersatechAi() {
  const context = useContext(VersatechAiContext);
  if (!context) {
    throw new Error("useVersatechAi must be used within VersatechAiProvider");
  }
  return context;
}
