"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function Error({ error, retry }: ErrorProps) {
  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="text-h2 text-foreground">Une erreur est survenue</h1>
      <p className="mt-2 text-body text-muted">
        Le contenu n&apos;a pas pu être affiché. Réessayez, ou revenez à
        Aujourd&apos;hui.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-meta text-faint">
          Réf. {error.digest}
        </p>
      ) : null}
      <Button className="mt-5" onClick={() => retry()}>
        Réessayer
      </Button>
    </Card>
  );
}
