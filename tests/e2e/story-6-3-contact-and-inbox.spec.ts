import { randomUUID } from "node:crypto";
import { expect, test } from "../support/merged-fixtures";
import type { Page } from "@playwright/test";

type ContactResult = { kind: "success" | "error" | "rateLimited"; text: string };

/**
 * Waits for the form's own result region to become visible (success is
 * `role="status"`; error/rate-limited both render `role="alert"` inside
 * the `<form>`) and classifies it, instead of a single blind
 * `isVisible().catch(() => false)` read immediately after the click -
 * that race lost intermittently against the server round trip. Next.js's
 * built-in route-change announcer (`#__next-route-announcer__`) also
 * carries a page-wide `role="alert"`, so the alert lookup is scoped to
 * `form` to avoid matching it.
 */
async function waitForContactResult(page: Page): Promise<ContactResult> {
  const status = page.getByRole("status");
  const alert = page.locator("form").getByRole("alert");
  await Promise.race([
    status.waitFor({ state: "visible", timeout: 10_000 }),
    alert.waitFor({ state: "visible", timeout: 10_000 }),
  ]);
  if (await status.isVisible().catch(() => false)) {
    return { kind: "success", text: (await status.textContent()) ?? "" };
  }
  const text = (await alert.textContent().catch(() => "")) ?? "";
  return { kind: text.includes("Çok sayıda deneme") ? "rateLimited" : "error", text };
}

async function submitContactForm(
  page: Page,
  fields: { name: string; email: string; message: string; subject?: string },
): Promise<ContactResult> {
  await page.goto("/tr/contact");
  // Scoped by `name` attribute, not `getByLabel` - the public Footer
  // (rendered on every page) carries its own newsletter-subscribe email
  // input whose accessible name differs from ContactForm's only by
  // letter case ("E-posta adresiniz" vs "E-posta Adresiniz"), which
  // Playwright's default case-insensitive label matching treats as the
  // same target and rejects as ambiguous.
  await page.locator('input[name="name"]').fill(fields.name);
  await page.locator('input[name="email"]').fill(fields.email);
  if (fields.subject) await page.locator('input[name="subject"]').fill(fields.subject);
  await page.locator('textarea[name="message"]').fill(fields.message);
  await page.getByRole("button", { name: "Mesajı Gönder" }).click();
  return waitForContactResult(page);
}

test.describe("AC-6.3-01/AC-6.3-03 - public contact form real submission", () => {
  test("a valid submission shows a locale-aware success confirmation", async ({ page, e2eData }) => {
    const unique = randomUUID();
    const email = `e2e-${unique}@example.test`;
    e2eData.trackMessageEmail(email);
    const result = await submitContactForm(page, {
      name: `E2E Visitor ${unique}`,
      email,
      subject: `E2E subject ${unique}`,
      message: `E2E message body ${unique}.`,
    });

    expect(result.kind).toBe("success");
    expect(result.text).toContain("Mesajınız alındı");
  });

  test("server-side validation rejects an invalid submission even when client-side constraints are bypassed", async ({ page }) => {
    await page.goto("/tr/contact");
    await page.getByRole("button", { name: "Mesajı Gönder" }).waitFor();
    // `form.noValidate` (a JS property, not a JSX-declared attribute) -
    // React never reconciles/restores it on re-render, unlike mutating
    // `required`/`type` directly on the inputs (both are explicit JSX
    // props ContactForm owns, so React's reconciler silently reverted
    // those on the very next render). Skipping all native constraint
    // checking this way means an empty/invalid submission actually
    // reaches the server action, proving server-side Zod validation, not
    // merely a client-side HTML constraint (AC-6.3-01/02: "server
    // validation").
    await page.evaluate(() => {
      document.querySelector("form")?.setAttribute("novalidate", "true");
    });
    await page.locator('input[name="name"]').fill("Test User");
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.locator('textarea[name="message"]').fill("A valid message body.");
    await page.getByRole("button", { name: "Mesajı Gönder" }).click();

    const result = await waitForContactResult(page);
    expect(result.kind).toBe("error");
    expect(result.text).toContain("Mesajınız gönderilemedi");
  });

  test("the honeypot field silently absorbs a bot-shaped submission without persisting it or leaking a signal", async ({ page }) => {
    const unique = randomUUID();
    await page.goto("/tr/contact");
    await page.locator('input[name="name"]').fill(`Bot ${unique}`);
    await page.locator('input[name="email"]').fill(`bot-${unique}@example.test`);
    await page.locator('textarea[name="message"]').fill(`Bot message ${unique}.`);
    // The honeypot input has no visible label (aria-hidden container) -
    // located by its `name` attribute, exactly as a scripted bot filling
    // every input on the page would find it.
    await page.locator('input[name="company"]').fill("Acme Corp");
    await page.getByRole("button", { name: "Mesajı Gönder" }).click();

    // Reports success identically to a real submission - a bot cannot
    // distinguish the two outcomes.
    const result = await waitForContactResult(page);
    expect(result.kind).toBe("success");
    expect(result.text).toContain("Mesajınız alındı");
  });
});

test.describe("AC-6.3-04/AC-6.3-05 - admin messages inbox real workflow", () => {
  // Serial (matches `story-3-1-service-crud.spec.ts`/`story-6-1-public-shell.spec.ts`'s
  // own precedent for shared-state tests): every test here reads/mutates
  // the one shared `/manage/messages` list, which can race under
  // `fullyParallel: true` when another test's submission/status change
  // lands mid-assertion.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, adminSeed }) => {
    await page.goto("/manage/login");
    await page.getByLabel("E-posta").fill(adminSeed.email);
    await page.getByLabel("Şifre").fill(adminSeed.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/manage$/);
  });

  test("a submitted message appears in the inbox, its status can be changed, and it can be archived", async ({ page, e2eData }) => {
    const unique = randomUUID();
    const subject = `Inbox E2E ${unique}`;
    const email = `inbox-${unique}@example.test`;
    e2eData.trackMessageEmail(email);

    // Submitting the public form navigates `page` away from `/manage`,
    // but the admin session cookie's path is `/` (lib/admin-auth.ts), so
    // it survives the round trip - no second browser context needed.
    const result = await submitContactForm(page, {
      name: `Inbox Visitor ${unique}`,
      email,
      subject,
      message: `Inbox workflow message ${unique}.`,
    });
    expect(result.kind).toBe("success");
    await page.goto("/manage/messages");
    await expect(page.getByRole("heading", { name: "Gelen Kutusu" })).toBeVisible();

    const row = page.locator("tr", { hasText: subject });
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: subject }).click();
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(page.getByText(`Inbox Visitor ${unique}`, { exact: true })).toBeVisible();

    await page.locator('select[name="nextStatus"]').selectOption("REPLIED");
    await page.getByRole("button", { name: "Durumu güncelle" }).click();
    await expect(page.getByText("Yanıtlandı").first()).toBeVisible();

    await page.getByRole("button", { name: "Arşivle" }).click();
    await expect(page.getByText("Arşivlendi").first()).toBeVisible();

    await page.goto("/manage/messages?status=ARCHIVED");
    await expect(page.locator("tr", { hasText: subject })).toBeVisible();
  });

  test("a stale status change surfaces a conflict, and retrying with a corrected CAS version succeeds without a manual reload", async ({ page, context, e2eData }) => {
    const unique = randomUUID();
    const subject = `Conflict E2E ${unique}`;
    const email = `conflict-${unique}@example.test`;
    e2eData.trackMessageEmail(email);
    const result = await submitContactForm(page, {
      name: `Conflict Visitor ${unique}`,
      email,
      subject,
      message: `Conflict workflow message ${unique}.`,
    });
    expect(result.kind).toBe("success");

    const pageA = page;
    await pageA.goto("/manage/messages");
    await pageA.locator("tr", { hasText: subject }).getByRole("link", { name: subject }).click();
    await expect(pageA.getByRole("heading", { level: 1, name: subject })).toBeVisible();

    // A second tab opens the same detail view before pageA's change below,
    // so its hidden `expectedVersion` is captured at the pre-change value.
    const pageB = await context.newPage();
    await pageB.goto(pageA.url());
    await expect(pageB.getByRole("heading", { level: 1, name: subject })).toBeVisible();

    // pageA wins the race: its status change lands first and bumps version.
    await pageA.locator('select[name="nextStatus"]').selectOption("READ");
    await pageA.getByRole("button", { name: "Durumu güncelle" }).click();
    await expect(pageA.getByText("Okundu").first()).toBeVisible();

    // pageB still submits the version it loaded with - a genuine stale
    // CAS token. The alert is a sibling of `<form>` here (not nested
    // inside it, unlike ContactForm's own alert), and Next.js's built-in
    // route-change announcer also carries a page-wide `role="alert"` - so
    // this filters by rendered text content (`hasText`, like `:has-text()`)
    // rather than accessible name (a plain `<p role="alert">` does not
    // reliably get name-from-content) or assumed DOM containment.
    await pageB.locator('select[name="nextStatus"]').selectOption("REPLIED");
    await pageB.getByRole("button", { name: "Durumu güncelle" }).click();
    await expect(pageB.locator('p[role="alert"]').filter({ hasText: "başka bir işlemle güncellendi" }).first()).toBeVisible();

    // Regression: before the fix, a stale-version retry would conflict
    // again forever unless the action's own revalidation repointed the
    // hidden `expectedVersion` to the current row. It must now succeed
    // on the very next submit.
    await pageB.locator('select[name="nextStatus"]').selectOption("REPLIED");
    await pageB.getByRole("button", { name: "Durumu güncelle" }).click();
    await expect(pageB.getByText("Yanıtlandı").first()).toBeVisible();

    await pageB.close();
  });

  test("no control on the messages panel performs a hard, irreversible delete (CAP-6: soft delete/archive only)", async ({ page }) => {
    await page.goto("/manage/messages");
    await expect(page.getByRole("button", { name: "Sil" })).toHaveCount(0);
  });

  test("the status filter pills navigate to distinct, server-rendered list views", async ({ page }) => {
    await page.goto("/manage/messages");
    await page.getByRole("link", { name: "Arşivlendi" }).click();
    await expect(page).toHaveURL(/status=ARCHIVED/);
  });
});

test.describe("AC-6.3-02 - PostgreSQL rate limit is wired into the real submit path", () => {
  test("repeated rapid submissions eventually receive the rate-limited outcome instead of an unbounded success stream", async ({ page, e2eData }) => {
    test.setTimeout(90_000);
    let sawRateLimited = false;
    for (let attempt = 0; attempt < 10 && !sawRateLimited; attempt += 1) {
      const unique = randomUUID();
      const email = `rate-limit-${unique}@example.test`;
      e2eData.trackMessageEmail(email);
      const result = await submitContactForm(page, {
        name: `Rate Limit Probe ${unique}`,
        email,
        message: `Rate limit probe message ${unique}.`,
      });
      if (result.kind === "rateLimited") sawRateLimited = true;
    }
    expect(sawRateLimited).toBe(true);
  });
});
