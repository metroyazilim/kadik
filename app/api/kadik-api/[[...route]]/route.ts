import { Hono } from "hono";
import { handle } from "hono/vercel";
import { prisma } from "@/lib/db";
import {
  KADIK_LOCALES,
  KADIK_PATHS,
  type KadikPageKey,
} from "@/lib/kadik-i18n";

const api = new Hono().basePath("/api/kadik-api");
const CONTENT_PAGE_KEYS = [
  "home",
  "about",
  "board",
  "events",
  "membership",
  "issues",
  "posts",
  "contact",
  "gallery",
] as const satisfies readonly KadikPageKey[];

const CONTENT_ROUTES = KADIK_LOCALES.flatMap((locale) =>
  CONTENT_PAGE_KEYS.map((pageKey) => KADIK_PATHS[pageKey][locale]),
);

api.get("/health", (context) => context.json({ ok: true, service: "kadik-api", version: "1" }));
api.get("/ready", async (context) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.adminUser.count();
    return context.json({ ok: true, database: "ready" });
  } catch {
    return context.json({ ok: false, database: "unavailable" }, 503);
  }
});
api.get("/content", (context) => context.json({
  site: "Kybele Atasever Dünya İş Konseyi",
  locale: "tr",
  routes: CONTENT_ROUTES,
}));

export const GET = handle(api);
