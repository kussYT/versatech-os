import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { getDatabaseUrl } from "../src/lib/db/env";

const SEED_ADMIN_EMAIL = "camille.durand@versatech.example";
const MIN_PASSWORD_LENGTH = 12;

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = input;
    const stdout = output;
    stdout.write(prompt);

    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(
        new Error(
          "Saisie masquée impossible hors terminal interactif. Relancez depuis un terminal local.",
        ),
      );
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\n" || char === "\r" || char === "\u0004") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Annulé."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char < " ") {
          continue;
        }
        value += char;
      }
    };

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.on("data", onData);
  });
}

async function setAdminIdentity() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to change the admin identity in production via this script.");
  }

  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });
  const rl = createInterface({ input, output });
  let promptClosed = false;

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        _count: {
          select: {
            createdInteractions: true,
            assignedTasks: true,
            stageChanges: true,
            activityLogs: true,
            tours: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (users.length === 0) {
      throw new Error("Aucun utilisateur en base. Ne lancez pas le seed : créez l'admin autrement.");
    }

    const current =
      users.find((user) => user.email === SEED_ADMIN_EMAIL) ??
      (users.length === 1 ? users[0] : null);

    if (!current) {
      throw new Error(
        "Plusieurs utilisateurs existent et l'admin seed n'a pas été trouvé. Intervention manuelle requise pour éviter de casser actorId.",
      );
    }

    output.write(
      `Utilisateur conservé (id inchangé) : ${current.email} (${current.id})\n` +
        `Relations : interactions=${current._count.createdInteractions}, ` +
        `tâches=${current._count.assignedTasks}, stages=${current._count.stageChanges}, ` +
        `activityLogs=${current._count.activityLogs}, tournées=${current._count.tours}\n`,
    );

    const email = (await rl.question("Nouvel e-mail admin VersaTech : ")).trim().toLowerCase();
    const emailConfirm = (await rl.question("Confirmez l'e-mail : ")).trim().toLowerCase();
    if (!email || !email.includes("@") || email !== emailConfirm) {
      throw new Error("E-mail invalide ou non confirmé.");
    }
    if (email.endsWith(".example")) {
      throw new Error("Refuse les adresses .example : indiquez le vrai e-mail VersaTech.");
    }

    const nameRaw = (await rl.question(`Nom affiché [${current.name}] : `)).trim();
    const name = nameRaw || current.name;
    rl.close();
    promptClosed = true;

    const password = await readHidden("Nouveau mot de passe (saisie masquée) : ");
    const passwordConfirm = await readHidden("Confirmez le mot de passe : ");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    }
    if (password !== passwordConfirm) {
      throw new Error("Les mots de passe ne correspondent pas.");
    }

    await prisma.user.update({
      where: { id: current.id },
      data: {
        email,
        name,
        role: "ADMIN",
        passwordHash: await hashPassword(password),
        sessionVersion: { increment: 1 },
      },
    });

    output.write(
      `Admin mis à jour. L'id ${current.id} est inchangé (historique ActivityLog conservé).\n` +
        `Connectez-vous avec ${email}. Ne stockez pas le mot de passe dans Git.\n`,
    );
  } finally {
    if (!promptClosed) {
      rl.close();
    }
    await prisma.$disconnect();
  }
}

setAdminIdentity().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
