import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(projectRoot, true);
const cluster = join(projectRoot, ".local/postgres");

function executable(name) {
  return [process.env.KADIK_PG_BIN && join(process.env.KADIK_PG_BIN, name), `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`]
    .find((path) => path && existsSync(path)) ?? name;
}

function localDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL eksik; .env.local dosyasını kontrol edin.");
  const url = new URL(process.env.DATABASE_URL);
  return url.hostname === "127.0.0.1" && url.port === "55432" && url.pathname === "/kadik";
}

export async function ensureDatabase() {
  if (localDatabase()) {
    if (!existsSync(join(cluster, "PG_VERSION"))) throw new Error("KADIK yerel cluster bulunamadı: .local/postgres. Yerel kurulum belgesini kontrol edin.");
    let running = false;
    try { execFileSync(executable("pg_ctl"), ["-D", cluster, "status"], { stdio: "ignore" }); running = true; } catch { /* A stopped cluster is started below. */ }
    if (!running) {
      console.log("KADIK: yerel PostgreSQL başlatılıyor (127.0.0.1:55432)…");
      execFileSync(executable("pg_ctl"), ["-D", cluster, "-l", join(cluster, "server.log"), "-o", "-p 55432 -h 127.0.0.1", "-w", "-t", "20", "start"], { stdio: "inherit" });
    }
  }
  const client = new PrismaClient();
  try {
    await client.$queryRaw`SELECT 1`;
    if (await client.adminUser.count() === 0) throw new Error("Admin hesabı yok. İlk kurulum için npm run db:seed çalıştırın.");
  } finally { await client.$disconnect(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await ensureDatabase(); console.log("KADIK: PostgreSQL, şema ve admin hazır."); }
  catch (error) { console.error("KADIK: veritabanı hazır değil.", error.message); process.exitCode = 1; }
}
