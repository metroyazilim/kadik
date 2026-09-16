import { execFileSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5432/corporate_website_starter";
const url = new URL(databaseUrl);
const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
  throw new Error("DATABASE_URL database name must contain only letters, numbers, and underscores.");
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";
const env = { ...process.env, PGCONNECT_TIMEOUT: "5" };
const args = ["-d", adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE \"${databaseName}\"`];

try {
  execFileSync("psql", args, { stdio: "inherit", env });
  console.log(`Created local PostgreSQL database: ${databaseName}`);
} catch (error) {
  console.error(`Could not create ${databaseName}. If it already exists, continue with migrations.`);
  process.exitCode = error?.status ?? 1;
}
