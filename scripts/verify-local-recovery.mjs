import { execFileSync } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ensureDatabase, projectRoot } from "./local-db.mjs";

const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/kadik");
const database = new PrismaClient();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const before = await database.adminUser.findMany({ orderBy: { id: "asc" }, select: { id: true, passwordHash: true, tokenVersion: true } });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:3901/manage/login");
  await page.getByLabel("E-posta", { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByLabel("Şifre", { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await database.$disconnect();
  execFileSync("/opt/homebrew/bin/pg_ctl", ["-D", join(projectRoot, ".local/postgres"), "-m", "fast", "-w", "stop"], { stdio: "inherit" });
  const offline = await fetch("http://localhost:3901/api/kadik-api/ready");
  assert.equal(offline.status, 503);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Yönetim hizmetine şu anda ulaşılamıyor" }).waitFor();
  console.log("PASS: DB kapalıyken readiness 503 ve login anlaşılır hata veriyor.");
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    if ((await fetch("http://localhost:3901/api/kadik-api/ready")).ok) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(ready, true, "Dev supervisor PostgreSQL'i 30 saniyede tekrar açmalı.");
  const after = await database.adminUser.findMany({ orderBy: { id: "asc" }, select: { id: true, passwordHash: true, tokenVersion: true } });
  assert.deepEqual(after, before, "Yeniden başlatma hesapları veya şifreyi değiştirmemeli.");
  await page.getByLabel("E-posta", { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByLabel("Şifre", { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.waitForURL("http://localhost:3901/manage");
  assert.deepEqual(errors, []);
  console.log("PASS: DB otomatik toparlandı; admin/şifre korundu ve login dashboard'a ulaştı.");
} finally {
  await ensureDatabase();
  await database.$disconnect();
  await browser.close();
}
