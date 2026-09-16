"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CreateProspectDialog } from "@/components/crm/create-prospect-dialog";

type ProspectComposerContextValue = {
  open: boolean;
  openComposer: () => void;
  closeComposer: () => void;
};

const ProspectComposerContext =
  createContext<ProspectComposerContextValue | null>(null);

export function ProspectComposerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openComposer = useCallback(() => setOpen(true), []);
  const closeComposer = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openComposer, closeComposer }),
    [open, openComposer, closeComposer],
  );

  return (
    <ProspectComposerContext.Provider value={value}>
      {children}
      <CreateProspectDialog
        open={open}
        onClose={closeComposer}
        onCreated={(name) => {
          closeComposer();
          setToast(`${name} a été ajouté à la prospection.`);
          window.setTimeout(() => setToast(null), 3200);
        }}
      />
      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 rounded-xl border border-border bg-surface-high px-4 py-3 text-body text-foreground shadow-[0_8px_24px_rgb(5_8_20_/_0.4)] lg:bottom-6 lg:left-auto lg:right-6 lg:w-auto"
        >
          {toast}
        </div>
      ) : null}
    </ProspectComposerContext.Provider>
  );
}

export function useProspectComposer() {
  const context = useContext(ProspectComposerContext);
  if (!context) {
    throw new Error("useProspectComposer must be used within ProspectComposerProvider");
  }
  return context;
}
