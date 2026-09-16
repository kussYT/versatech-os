import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export default function CompanyNotFound() {
  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="text-h2 text-foreground">Entreprise introuvable</h1>
      <p className="mt-2 text-body text-muted">
        Cette fiche n&apos;existe pas, ou l&apos;identifiant est incorrect.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/entreprises" className={cn(buttonVariants())}>
          <span className="relative z-10">Retour aux entreprises</span>
        </Link>
        <Link href="/prospection" className={cn(buttonVariants({ variant: "secondary" }))}>
          Prospection
        </Link>
      </div>
    </Card>
  );
}
