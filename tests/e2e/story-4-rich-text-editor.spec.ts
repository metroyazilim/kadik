import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test, log } from "../support/merged-fixtures";

// Spec 4: maintained Tiptap editor + maintained sanitizer. This suite covers
// the acceptance criteria the sanitizer/read-time-boundary unit and
// integration suites cannot: real toolbar interaction, the client-side
// length/required submission guard (AC-4.11), locale-tab-switch/post-save
// editor-state integrity without a loop (AC-4.13), and accessibility/RTL
// (AC-4.14). AC-4.3's publish-reaches-public-page-with-real-markup proof
// lives in the extended `story-3-1-service-crud.spec.ts`.

const REACT_LOOP_PATTERN = /Maximum update depth exceeded|Too many re-renders/i;

async function login(page: Page, adminSeed: { email: string; password: string }): Promise<void> {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta").fill(adminSeed.email);
  await page.getByLabel("Şifre").fill(adminSeed.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/manage(\?|$)/);
}

async function createDraftTeamMember(page: Page): Promise<void> {
  await page.goto("/manage/team");
  await expect(page.getByRole("heading", { name: "Ekip Üyeleri" })).toBeVisible();
  await page.getByRole("button", { name: "Yeni üye" }).click();
  await page.waitForURL(/\/manage\/team\/[^/?]+/);
  await expect(page.getByLabel("Ad soyad")).toBeVisible();
}

test.describe("Spec 4 - Tiptap rich-text editor", () => {
  test.describe.configure({ mode: "serial" });

  test("[P0] AC-4.1/4.14: toolbar formatting produces real markup with correct aria-pressed and accessible-name wiring", async ({
    page,
    adminSeed,
  }) => {
    await log.step("Open a fresh Team member drawer");
    await login(page, adminSeed);
    await createDraftTeamMember(page);
    const bio = page.getByRole("textbox", { name: "Biyografi" });

    await log.step("The editable region has an accessible name tied to its label, not a raw textarea");
    await expect(bio).toBeVisible();
    await expect(page.locator('label:has-text("Biyografi")')).toBeVisible();
    await expect(bio).not.toHaveJSProperty("tagName", "TEXTAREA");
    await expect(bio.locator("xpath=self::*[@contenteditable='true']")).toBeVisible();

    await log.step("Typing plain text, then toggling Bold via the toolbar produces a real <strong>, not typed tag characters");
    await bio.fill("Formatted biography text");
    await bio.selectText();
    const boldButton = page.getByRole("button", { name: "Kalın" });
    await expect(boldButton).toHaveAttribute("aria-pressed", "false");
    await boldButton.click();
    await expect(boldButton).toHaveAttribute("aria-pressed", "true");
    await expect(bio.locator("strong")).toHaveText("Formatted biography text");

    await log.step("The heading toolbar button produces a real <h2> and reports aria-pressed");
    await bio.fill("A heading line");
    await bio.selectText();
    await page.getByRole("button", { name: "H2 stili" }).click();
    await expect(page.getByRole("button", { name: "H2 stili" })).toHaveAttribute("aria-pressed", "true");
    await expect(bio.locator("h2")).toHaveText("A heading line");

    await log.step("The list and blockquote toolbar buttons produce their real elements");
    await bio.fill("List item one");
    await bio.selectText();
    await page.getByRole("button", { name: "Madde listesi" }).click();
    await expect(bio.locator("ul li", { hasText: "List item one" })).toHaveCount(1);
    await bio.fill("A quoted line");
    await bio.selectText();
    await page.getByRole("button", { name: "Alıntı" }).click();
    await expect(bio.locator("blockquote")).toContainText("A quoted line");

    await log.step("The 'Metin bağlantısı ekle' control rejects a javascript: URL and accepts a safe one");
    await bio.fill("link text");
    await bio.selectText();
    await page.getByRole("button", { name: "Metin bağlantısı ekle" }).click();
    await page.getByLabel("Bağlantı adresi").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Ekle", exact: true }).click();
    await expect(page.locator('p[role="alert"]').filter({ hasText: /desteklenmiyor/i })).toBeVisible();
    await page.getByLabel("Bağlantı adresi").fill("/hakkimizda");
    await page.getByRole("button", { name: "Ekle", exact: true }).click();
    await expect(bio.locator('a[href="/hakkimizda"]')).toHaveText("link text");
  });

  test("[P0] AC-4.11: exceeding the server-enforced length blocks submission with an accessible error", async ({ page, adminSeed }) => {
    await log.step("Open a fresh Team member drawer and fill the required fields");
    await login(page, adminSeed);
    await createDraftTeamMember(page);
    const suffix = randomUUID().slice(0, 8);
    await page.getByLabel("Ad soyad").fill(`E2E Limit Test ${suffix}`);
    await page.locator('input[name="slug"]').fill(`e2e-limit-${suffix}`);
    await page.getByLabel("Görev / unvan").fill("E2E Görev");

    await log.step("An over-limit bio (>4000 HTML characters) blocks the native submission with an accessible error, client-side");
    const bio = page.getByRole("textbox", { name: "Biyografi" });
    await bio.fill("x".repeat(4001));
    await expect(page.getByText(/4001 \/ 4000|400\d \/ 4000/)).toBeVisible();
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.locator('p[role="alert"]').filter({ hasText: /en fazla 4000 karakter/i })).toBeVisible();
    // Blocked client-side: no draft-saved status ever appears.
    await expect(page.locator('p[role="status"]')).toHaveCount(0);

    await log.step("A within-limit bio saves normally, proving the guard only blocks the genuinely over-limit case");
    await bio.fill(`Within limit bio ${suffix}.`);
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.locator('p[role="status"]')).toContainText("TR taslağı kaydedildi.");
  });

  test("[P0] AC-4.13: locale-tab switch and post-save refetch never wipe in-progress input or loop", async ({
    page,
    adminSeed,
    e2eData,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const suffix = randomUUID().slice(0, 8);
    const name = `E2E State Integrity ${suffix}`;

    await log.step("Create a Team member, save a Turkish bio, then switch to the English tab");
    await login(page, adminSeed);
    await createDraftTeamMember(page);
    await page.getByLabel("Ad soyad").fill(name);
    await page.locator('input[name="slug"]').fill(`e2e-state-${suffix}`);
    await page.getByLabel("Görev / unvan").fill("E2E Görev");
    const trBio = page.getByRole("textbox", { name: "Biyografi" });
    await trBio.fill(`Turkish bio ${suffix}.`);
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.locator('p[role="status"]')).toContainText("TR taslağı kaydedildi.");
    const entityId = await e2eData.findEntityIdByMarker(suffix);
    if (!entityId) throw new Error(`Expected a ContentTranslationRevision containing marker "${suffix}" after the draft save.`);
    await e2eData.trackContentEntity(entityId);

    await page.getByRole("tab", { name: /^EN/ }).click();
    await log.step("The English editor mounts empty, not carrying over the Turkish content");
    const enBio = page.getByRole("textbox", { name: "Biyografi" });
    await expect(enBio).toHaveText("");

    await log.step("Typing into the fresh English editor and switching back to Turkish never triggers a React update-depth loop");
    await enBio.fill("English bio in progress");
    await page.getByRole("tab", { name: /^TR/ }).click();
    await expect(page.getByRole("textbox", { name: "Biyografi" })).toHaveText(`Turkish bio ${suffix}.`);

    await log.step("A post-save refetch on the same locale does not desynchronize the editor or loop");
    const bio = page.getByRole("textbox", { name: "Biyografi" });
    await bio.fill(`Turkish bio ${suffix} v2.`);
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.locator('p[role="status"]')).toContainText("TR taslağı kaydedildi.");
    await page.waitForLoadState("networkidle", { timeout: 5_000 });

    expect(consoleErrors.filter((text) => REACT_LOOP_PATTERN.test(text))).toEqual([]);
  });

  test("[P0] AC-4.14: Arabic content is authored RTL-correct", async ({ page, adminSeed }) => {
    await log.step("Open a fresh Team member editor and switch to the Arabic tab");
    await login(page, adminSeed);
    await createDraftTeamMember(page);
    await page.getByRole("tab", { name: /^AR/ }).click();
    const arBio = page.getByRole("textbox", { name: "Biyografi" });
    await arBio.click();
    await arBio.type("مرحبا بالعالم");
    const direction = await arBio.evaluate((el) => getComputedStyle(el).direction);
    expect(direction).toBe("rtl");
  });
});
