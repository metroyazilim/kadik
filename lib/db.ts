import { PrismaClient } from "@prisma/client";
import { requireDatabase } from "./env";

const globalForPrisma = globalThis as unknown as { metroPrisma?: PrismaClient };

export function getPrisma() {
  requireDatabase();
  if (!globalForPrisma.metroPrisma) {
    globalForPrisma.metroPrisma = new PrismaClient();
  }
  return globalForPrisma.metroPrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    return Reflect.get(getPrisma(), property);
  },
});
