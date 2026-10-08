"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type PipelineDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function PipelineDrawer({ open, onClose, title, children }: PipelineDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = "pipeline-quick-view-title";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="vt-drawer"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="vt-dialog-header">
        <h2 id={titleId} className="text-h2 text-foreground">
          {title}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer l'aperçu">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="vt-dialog-body">{children}</div>
    </dialog>
  );
}
