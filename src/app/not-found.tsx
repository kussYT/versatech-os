import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="text-h2 text-foreground">Page introuvable</h1>
      <p className="mt-2 text-body text-muted">
        Cette page n&apos;existe pas encore, ou l&apos;adresse est incorrecte.
      </p>
      <Link href="/" className={cn(buttonVariants(), "mt-5")}>
        <span className="relative z-10">Retour à Aujourd&apos;hui</span>
      </Link>
    </Card>
  );
}
