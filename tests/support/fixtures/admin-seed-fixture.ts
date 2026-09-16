import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { test as base } from "@playwright/test";

// This fixture runs in the Playwright test process, not the `next dev`
// child process playwright.config.ts's webServer spawns - that child loads
// its own .env independently. Load .env here too, once, so this fixture
// connects to the SAME database the live dev server the E2E tests drive is
// actually using (not the isolated per-run schema story-0-1-fixture.ts uses,
// which the dev server process has no knowledge of).
try {
  process.loadEnvFile();
} catch {
  // No .env file present - fine when DATABASE_URL is supplied directly (CI).
}

export type AdminSeed = {
  email: string;
  password: string;
  userId: string;
  bumpTokenVersion: () => Promise<void>;
};

export type AdminSeedFixtures = { adminSeed: AdminSeed };

let sharedClient: PrismaClient | undefined;
function client() {
  if (!sharedClient) sharedClient = new PrismaClient();
  return sharedClient;
}

export const test = base.extend<AdminSeedFixtures>({
  adminSeed: async ({}, fixtureUse, testInfo) => {
    const email = `e2e-${testInfo.testId}-${randomUUID().slice(0, 8)}@example.com`.toLowerCase();
    const password = "Story1-1-E2E-Seed-Pw!";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await client().adminUser.create({
      data: { email, passwordHash, name: "Story 1.1 E2E Seed" },
    });

    await fixtureUse({
      email,
      password,
      userId: user.id,
      bumpTokenVersion: async () => {
        await client().adminUser.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
      },
    });

    await client()
      .adminUser.delete({ where: { id: user.id } })
      .catch(() => undefined);
  },
});
