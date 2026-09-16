import { Hono } from "hono";
import { handle } from "hono/vercel";

const api = new Hono().basePath("/api/kadik-api");

api.get("/health", (context) => context.json({ ok: true, service: "kadik-api", version: "1" }));
api.get("/content", (context) => context.json({
  site: "Kadık",
  locale: "tr",
  routes: ["/", "/hakkimizda", "/etkinlikler", "/gonulluluk", "/duyurular", "/yazilar", "/iletisim", "/galeri"],
}));

export const GET = handle(api);
