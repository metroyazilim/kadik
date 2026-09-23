// Moves the KADİK page copy that ships with the code into the database
// (`KadikPageContent`) for every page that has no row yet. Idempotent: an
// already edited page is never overwritten. The admin "Sayfalar" screen runs
// the same step on first visit; this CLI exists for fresh deployments.
//
//   npm run db:seed-kadik-pages
import { PrismaClient, type Prisma } from "@prisma/client";
import { KADIK_CONTENT_KEYS, kadikPageDefaults } from "../lib/kadik-content/pages";

const prisma = new PrismaClient();

async function run(): Promise<void> {
  const existing = new Set((await prisma.kadikPageContent.findMany({ select: { key: true } })).map((row) => row.key));
  const missing = KADIK_CONTENT_KEYS.filter((key) => !existing.has(key));
  if (missing.length > 0) {
    await prisma.kadikPageContent.createMany({
      data: missing.map((key) => ({ key, data: kadikPageDefaults(key) as Prisma.InputJsonValue })),
      skipDuplicates: true,
    });
  }
  console.log(`KADIK sayfaları: ${missing.length} yeni sayfa aktarıldı, ${existing.size} sayfa zaten vardı.`);
}

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
