import { Hono } from "hono";
import { handle } from "hono/vercel";
import { prisma } from "@/lib/db";

const api = new Hono().basePath("/api/kadik-api");

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
  routes: ["/", "/hakkimizda", "/kurul-uyeleri", "/etkinlikler", "/uyelik", "/duyurular", "/yazilar", "/iletisim", "/galeri"],
}));

export const GET = handle(api);
