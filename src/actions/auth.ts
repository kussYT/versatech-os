"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/crm/action-result";
import { consumeLoginAttempt, loginAttemptKey, resetLoginAttempts } from "@/lib/auth/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeRedirectPath } from "@/lib/auth/paths";
import { createSession, destroySession, getSessionUser, invalidateUserSessions } from "@/lib/auth/session";
import { readString } from "@/lib/crm/form-data";
import { prisma } from "@/lib/db/prisma";
import { fieldErrorsFromZod, loginSchema } from "@/lib/validations/auth";

let dummyPasswordHashPromise: Promise<string> | null = null;

function dummyPasswordHash() {
  dummyPasswordHashPromise ??= hashPassword("timing-safe-dummy");
  return dummyPasswordHashPromise;
}

async function clientIp() {
  const headerStore = await headers();
  return (
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function login(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: readString(formData, "email"),
    password: readString(formData, "password"),
    from: readString(formData, "from"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const ip = await clientIp();
  const attempt = consumeLoginAttempt(loginAttemptKey(parsed.data.email, ip));
  if (!attempt.allowed) {
    return {
      ok: false,
      message: "Trop de tentatives. Réessayez dans quelques minutes.",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true },
    });

    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash());
    const passwordOk = await verifyPassword(parsed.data.password, passwordHash);

    if (!user?.passwordHash || !passwordOk) {
      return { ok: false, message: "Identifiants incorrects." };
    }

    resetLoginAttempts(loginAttemptKey(parsed.data.email, ip));
    await createSession(user.id);
  } catch {
    return { ok: false, message: "Connexion impossible pour le moment. Réessayez." };
  }

  redirect(safeRedirectPath(parsed.data.from));
}

export async function logout() {
  const user = await getSessionUser();
  if (user) {
    await invalidateUserSessions(user.id);
  }
  await destroySession();
  redirect("/connexion");
}
