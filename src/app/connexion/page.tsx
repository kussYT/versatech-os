import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <p className="brand-wordmark text-sm font-semibold tracking-[0.2em] text-foreground">
            VERSATECH
          </p>
          <p className="mt-1 font-mono text-[11px] tracking-[0.32em] text-muted">OS</p>
          <h1 className="mt-5 text-h2 text-foreground">Connexion</h1>
          <p className="mt-1.5 text-meta text-muted">
            Outil interne. Accès réservé aux comptes VersaTech.
          </p>
        </div>
        <Suspense fallback={<p className="text-meta text-muted">Chargement…</p>}>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
