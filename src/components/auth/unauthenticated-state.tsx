"use client";

import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LOGIN_PATH } from "@/lib/auth/config";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";

export function UnauthenticatedState() {
  return (
    <div className="app-canvas flex min-h-full items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <ShieldOff className="size-5 text-muted" aria-hidden="true" />
        <h1 className="mt-4 text-h2 text-foreground">Session requise</h1>
        <p className="mt-2 text-meta text-muted">
          Connectez-vous pour accéder à VersaTech OS. Les données métier restent
          masquées hors session.
        </p>
        <Link
          href={LOGIN_PATH}
          className={cn(buttonVariants({ variant: "primary" }), "mt-6 inline-flex")}
        >
          Se connecter
        </Link>
      </Card>
    </div>
  );
}
