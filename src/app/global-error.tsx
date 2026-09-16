"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
          <h1 className="text-h2">VersaTech OS indisponible</h1>
          <p className="mt-2 text-body text-muted">
            Une erreur technique a interrompu l&apos;application. Réessayez.
          </p>
          {error.digest ? (
            <p className="mt-3 font-mono text-meta text-faint">
              Réf. {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            className={`${buttonVariants()} mt-5 self-start`}
            onClick={() => retry()}
          >
            <span className="relative z-10">Réessayer</span>
          </button>
        </main>
      </body>
    </html>
  );
}
