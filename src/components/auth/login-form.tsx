"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { safeRedirectPath } from "@/lib/auth/paths";

export function LoginForm() {
  const searchParams = useSearchParams();
  const from = safeRedirectPath(searchParams.get("from"));
  const [state, formAction, pending] = useActionState(login, idleActionResult);
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="from" value={from} />
      {state.message && !state.ok ? (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <Field label="E-mail" htmlFor="login-email" error={firstError("email")}>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={pending}
          placeholder="prenom@versatech.example"
          className={controlClassName}
        />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="login-password"
        error={firstError("password")}
      >
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
