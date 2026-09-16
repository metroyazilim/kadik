import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test, log } from "../support/merged-fixtures";

// Spec 1 AC-7: a save and a publish each cost exactly one server round trip.
//
// Before Spec 1 the editor lived in a drawer that fetched its own edit view,
// so a single draft save produced three sequential requests: the action, a
// `get<X>EditViewAction` refetch, and a full-page `router.refresh()` GET.
// The editor is now a route whose data comes from its own server render, and
// the action's `revalidatePath` is what refreshes it - so the count below is
// the load-bearing assertion, not a performance nicety.

async function login(page: Page, adminSeed: { email: string; password: string }): Promise<void> {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta").fill(adminSeed.email);
  await page.getByLabel("Şifre").fill(adminSeed.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/manage$/);
}

test.describe("Spec 1 - editor round trips", () => {
  test("AC-7: saving a draft and publishing each take one request, and publish enables without a reload", async ({
    page,
    adminSeed,
    e2eData,
  }) => {
    const suffix = randomUUID().slice(0, 8);
    const title = `E2E roundtrip ${suffix}`;

    await login(page, adminSeed);

    await log.step("Create a service - the create route redirects to the record's own address");
    await page.goto("/manage/services");
    await page.getByRole("button", { name: "Yeni hizmet" }).click();
    await page.waitForURL(/\/manage\/services\/[^/?]+/);
    const entityId = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(entityId).not.toBe("");

    // A brand-new record has no draft in any locale, so publishing is impossible.
    const publishButton = page.getByRole("button", { name: "Bu dili yayınla" });
    await expect(publishButton).toBeDisabled();

    await log.step("Fill the required fields");
    await page.getByLabel("Başlık").fill(title);
    await page.locator('input[name="slug"]').fill(`e2e-roundtrip-${suffix}`);
    await page.getByLabel("Özet").fill(`Summary for ${title}.`);
    if ((await page.getByRole("textbox", { name: "Metin" }).count()) === 0) {
      await page.getByRole("button", { name: "Metin ekle" }).click();
    }
    await page.getByRole("textbox", { name: "Metin" }).fill(`Body for ${title}.`);

    await log.step("Save the draft and count the requests it costs");
    const requestsDuringSave: string[] = [];
    const record = (method: string, url: string) => {
      if (url.includes("/manage/services")) requestsDuringSave.push(`${method} ${new URL(url).pathname}`);
    };
    const listener = (request: { method(): string; url(): string }) => record(request.method(), request.url());
    page.on("request", listener);

    const versionField = page.locator('input[name="expectedVersion"]');
    const versionBefore = await versionField.inputValue();
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.locator('p[role="status"]')).toContainText("TR taslağı kaydedildi.");
    // The server action's revalidation is what repoints the hidden
    // concurrency token and re-enables publishing - no client refetch.
    await expect(versionField).not.toHaveValue(versionBefore);
    await expect(publishButton).toBeEnabled();
    page.off("request", listener);

    await e2eData.trackContentEntity(entityId);

    const saveRequests = requestsDuringSave.filter((entry) => entry.startsWith("POST"));
    expect(
      saveRequests.length,
      `a draft save must be one POST, got: ${requestsDuringSave.join(", ")}`,
    ).toBe(1);
    expect(
      requestsDuringSave.filter((entry) => entry.startsWith("GET")),
      "a draft save must not trigger a separate full-page GET",
    ).toEqual([]);

    await log.step("Publish and count again - the publish result must not be masked by the earlier save");
    const requestsDuringPublish: string[] = [];
    const publishListener = (request: { method(): string; url(): string }) => {
      if (request.url().includes("/manage/services")) {
        requestsDuringPublish.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    };
    page.on("request", publishListener);
    await publishButton.click();
    await expect(page.locator('p[role="status"]')).toContainText("TR yayınlandı.");
    page.off("request", publishListener);

    expect(
      requestsDuringPublish.filter((entry) => entry.startsWith("POST")).length,
      `a publish must be one POST, got: ${requestsDuringPublish.join(", ")}`,
    ).toBe(1);
  });
});
