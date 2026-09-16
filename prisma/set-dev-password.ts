import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { getDatabaseUrl } from "../src/lib/db/env";

async function setDevPassword() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to set a development password in production.");
  }

  const email =
    process.env.AUTH_DEV_EMAIL?.trim() || "camille.durand@versatech.example";
  const password = process.env.AUTH_DEV_PASSWORD?.trim();

  if (!password) {
    throw new Error(
      "AUTH_DEV_PASSWORD is missing. Copy .env.example and set a local-only password.",
    );
  }

  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.user.updateMany({
      where: { email },
      data: { passwordHash },
    });

    if (result.count === 0) {
      throw new Error(
        `No user found for ${email}. Run the development seed or create the user first.`,
      );
    }

    console.info("Development password hash updated.", { email, updated: result.count });
  } finally {
    await prisma.$disconnect();
  }
}

setDevPassword().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
