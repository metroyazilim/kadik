// Writes a plain-SQL dump of the KADİK database to `backups/`.
//
//   npm run db:export            -> backups/kadik-YYYY-MM-DD-HHmm.sql
//   npm run db:export -- out.sql -> out.sql
//
// Restore on another server (empty database):
//   psql "postgresql://USER:PASS@HOST:5432/DBNAME" -f kadik.sql
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import nextEnv from "@next/env";
import { projectRoot } from "./local-db.mjs";

nextEnv.loadEnvConfig(projectRoot, true);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL eksik; .env.local dosyasını kontrol edin.");
  process.exit(1);
}

function executable(name) {
  return [process.env.KADIK_PG_BIN && join(process.env.KADIK_PG_BIN, name), `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`]
    .find((path) => path && existsSync(path)) ?? name;
}

const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const target = resolve(process.argv[2] ?? join(projectRoot, "backups", `kadik-${stamp}.sql`));
mkdirSync(dirname(target), { recursive: true });

// Prisma's `?schema=public` query is not understood by libpq.
const url = new URL(databaseUrl);
url.searchParams.delete("schema");

execFileSync(executable("pg_dump"), ["--no-owner", "--no-privileges", "--format=plain", "--file", target, url.toString()], { stdio: "inherit" });
console.log(`KADIK veritabanı dışa aktarıldı: ${target}`);
