import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
import { ensureDatabase, projectRoot } from "./local-db.mjs";

try { await ensureDatabase(); }
catch (error) { console.error("KADIK başlatılamadı: veritabanı hazır değil.", error.message); process.exit(1); }

// Keeps the local schema and the generated Prisma client in step with the
// code after every pull: new migrations are applied (never destructive -
// `migrate deploy` only runs pending files) and the client is regenerated.
const prismaCli = join(projectRoot, "node_modules/.bin/prisma");
try {
  execFileSync(prismaCli, ["migrate", "deploy"], { cwd: projectRoot, stdio: "inherit", env: process.env });
  execFileSync(prismaCli, ["generate"], { cwd: projectRoot, stdio: "inherit", env: process.env });
} catch (error) {
  console.error("KADIK başlatılamadı: veritabanı şeması güncellenemedi.", error.message);
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.some((arg) => arg === "-p" || arg === "--port" || arg.startsWith("--port="))) args.push("--port", "3901");
const child = spawn(process.execPath, [join(projectRoot, "node_modules/next/dist/bin/next"), "dev", ...args], { cwd: projectRoot, stdio: "inherit", env: process.env });
let checking = false;
const interval = setInterval(async () => {
  if (checking) return;
  checking = true;
  try { await ensureDatabase(); }
  catch (error) { console.error("KADIK veritabanı kontrolü:", error.message); }
  finally { checking = false; }
}, 15000);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { clearInterval(interval); child.kill(signal); });
child.on("error", (error) => { clearInterval(interval); console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { clearInterval(interval); process.exitCode = code ?? 0; });
