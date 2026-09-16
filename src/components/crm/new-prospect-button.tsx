"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProspectComposer } from "@/components/crm/prospect-composer";
import type { ButtonVariantProps } from "@/components/ui/button-variants";

type NewProspectButtonProps = ButtonVariantProps & {
  className?: string;
  children?: string;
  iconOnly?: boolean;
};

export function NewProspectButton({
  className,
  children = "Nouveau prospect",
  iconOnly = false,
  variant,
  size,
}: NewProspectButtonProps) {
  const { openComposer } = useProspectComposer();

  return (
    <Button
      variant={variant}
      size={iconOnly ? "icon" : size}
      className={className}
      onClick={openComposer}
      aria-label="Nouveau prospect"
    >
      <Plus className="size-4" aria-hidden="true" />
      {iconOnly ? null : children}
    </Button>
  );
}
