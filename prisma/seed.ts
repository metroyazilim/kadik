// Deterministic, idempotent bootstrap for a fresh environment: the first
// SUPER_ADMIN plus every registry row the admin panel expects to exist
// (site settings, the eleven fixed Home sections, the content pages).
// The starter contains only generic demo content; customer data is never
// copied into a new project.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { getAdminBootstrap } from "../lib/env";
import { ensureSiteSettingsEntity } from "../lib/content-model/site-settings-registry";
import { ensureHomeSectionRegistry } from "../lib/content-model/home-section-registry";
import {
  CONTENT_PAGE_KEYS,
  ensureContentPageEntity,
} from "../lib/content-model/content-page-registry";
import { seedHomeClientData } from "../scripts/seed-home-client-data";

const prisma = new PrismaClient();

async function seedAdmin(): Promise<void> {
  const { email, password } = getAdminBootstrap();
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });

  if (!existing) {
    await prisma.adminUser.create({
      data: { email: normalizedEmail, passwordHash, name: "Starter Admin", role: "SUPER_ADMIN" },
    });
    console.log(`seed: created SUPER_ADMIN ${normalizedEmail}`);
    return;
  }

  // Re-running the seed resets the bootstrap admin's password and role, and
  // invalidates its live sessions - that is the documented recovery path.
  await prisma.adminUser.update({
    where: { id: existing.id },
    data: { passwordHash, role: "SUPER_ADMIN", tokenVersion: { increment: 1 } },
  });
  console.log(`seed: reset SUPER_ADMIN ${normalizedEmail}`);
}

async function main(): Promise<void> {
  await seedAdmin();
  await ensureSiteSettingsEntity(prisma);
  await ensureHomeSectionRegistry(prisma);
  for (const key of CONTENT_PAGE_KEYS) {
    await ensureContentPageEntity(prisma, key);
  }
  await seedHomeClientData(prisma);
  console.log("seed: registries and generic demo content ensured");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
