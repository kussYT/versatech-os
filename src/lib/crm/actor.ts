import "server-only";

import { prisma } from "@/lib/db/prisma";

export async function getActorUser() {
  const existing = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      name: "VersaTech OS",
      email: "os@versatech.example",
      role: "ADMIN",
    },
  });
}
