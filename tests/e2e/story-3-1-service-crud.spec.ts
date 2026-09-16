import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { expect, test, log } from "../support/merged-fixtures";

// Drives the real Service admin surface as it exists after Spec 1: a list
// page at `/manage/services`, a create route that redirects to
// `/manage/services/<id>`, and a full-page editor there (no drawer), with
// the typed `ContentBlockEditor`/`RichTextEditor` block fields
// (schemaVersion 2 replaced the flat `body` textarea). The draft → publish
// → public-route behaviour asserted below is unchanged by that move.

type ServiceDraft = Readonly<{
  title: string;
  slug: string;
  summary: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
}>;

/** A freshly created entity is appended at the end of the drag-and-drop
 * order, which - now that the list is paginated (Spec 1 AC-6) - almost
 * never lands on page 1. Walks forward until the row is found or a
 * generous page bound is exhausted, rather than assuming a page number. */
async function findServiceRowByTitle(page: Page, title: string) {
  for (let pageNumber = 1; pageNumber <= 25; pageNumber += 1) {
    await page.goto(`/manage/services?page=${pageNumber}`);
    const row = page.getByTestId("service-row").filter({ hasText: title });
    if (await row.count()) return row;
    const hasNext = await page.getByRole("link", { name: "Sonraki" }).isVisible().catch(() => false);
    if (!hasNext) break;
  }
  throw new Error(`Service row "${title}" not found in any admin list page.`);
}

const INTERNAL_ERROR_PATTERN =
  /PrismaClientKnownRequestError|P20\d{2}|node_modules|DATABASE_URL|at [A-Za-z0-9_$.]+ \(/i;

function serviceDraft(intent: string, overrides: Partial<ServiceDraft> = {}): ServiceDraft {
  const suffix = randomUUID().slice(0, 8);
  return {
    title: `E2E ${intent} ${suffix}`,
    slug: `${intent}-${suffix}`,
    summary: `Summary for ${intent} ${suffix}.`,
    body: `Body content for ${intent} ${suffix}.`,
    seoTitle: `${intent} SEO title ${suffix}`,
    seoDescription: `${intent} SEO description ${suffix}.`,
    ...overrides,
  };
}

async function login(page: Page, adminSeed: { email: string; password: string }): Promise<void> {
  await page.goto("/manage/login");
  await page.getByLabel("E-posta").fill(adminSeed.email);
  await page.getByLabel("Şifre").fill(adminSeed.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/manage(\?|$)/);
}

/** Creates a brand-new Service entity from the list page and returns its id, read from the editor address the create route redirects to. */
async function createDraftService(page: Page): Promise<string> {
  await page.goto("/manage/services");
  await expect(page.getByRole("heading", { name: "Hizmet Kataloğu" })).toBeVisible();
  await page.getByRole("button", { name: "Yeni hizmet" }).click();
  await page.waitForURL(/\/manage\/services\/[^/?]+/);
  const entityId = new URL(page.url()).pathname.split("/").pop() ?? "";
  if (!entityId) throw new Error("Expected a created Service entity id in the URL.");
  await expect(page.getByLabel("Başlık")).toBeVisible();
  return entityId;
}

/** Fills the active locale's editor form: text fields plus one "text" content block via the real `ContentBlockEditor`/`RichTextEditor` controls - the block is filled with plain text (Spec 4: the field is a real Tiptap WYSIWYG region now, not a textarea, so `.fill()` inserts literal text rather than parsing markup). */
async function fillDraftForm(page: Page, draft: ServiceDraft): Promise<void> {
  await page.getByLabel("Başlık").fill(draft.title);
  await page.locator('input[name="slug"]').fill(draft.slug);
  await page.getByLabel("Özet").fill(draft.summary);
  const blockCount = await page.getByRole("textbox", { name: "Metin" }).count();
  if (blockCount === 0) {
    await page.getByRole("button", { name: "Metin ekle" }).click();
  }
  await page.getByRole("textbox", { name: "Metin" }).fill(draft.body);
  await page.getByLabel("SEO başlığı").fill(draft.seoTitle);
  await page.getByLabel("SEO açıklaması").fill(draft.seoDescription);
}

async function saveDraft(page: Page, expectedLocaleLabel: string): Promise<void> {
  const versionField = page.locator('input[name="expectedVersion"]');
  const versionBefore = await versionField.inputValue();
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.locator('p[role="status"]')).toContainText(`${expectedLocaleLabel} taslağı kaydedildi.`);
  // A successful draft save triggers a background refetch that repoints
  // the drawer's hidden `expectedVersion`/`draftRevisionId` concurrency
  // tokens (`onMutated` -> `refetch` in `ServiceEditorPanel`) at the
  // version the save just produced. A next click that races ahead of that
  // refetch submits the *previous* version and gets a false conflict from
  // `adminPublish`/`adminSaveDraft`'s own optimistic-concurrency check -
  // waiting for the hidden field to actually change closes that window
  // deterministically, without guessing at a fixed delay.
  await expect(versionField).not.toHaveValue(versionBefore);
}

async function publish(page: Page, expectedLocaleLabel: string): Promise<void> {
  await page.getByRole("button", { name: "Bu dili yayınla" }).click();
  await expect(page.locator('p[role="status"]')).toContainText(`${expectedLocaleLabel} yayınlandı.`);
}

test.describe("Story 3.1 locale-aware Service CRUD journey (AC-3.1-01..07)", () => {
  test.describe.configure({ mode: "serial" });

  test("[P0] AC-3.1-01/02/03/05: admin creates, edits, saves, publishes, and visits a Turkish Service", async ({ page, adminSeed, e2eData }) => {
    const draft = serviceDraft("published-service");
    const editedSummary = `${draft.summary} Edited before publication.`;

    await log.step("Log in and create a Service in the unified workspace");
    await login(page, adminSeed);
    const entityId = await createDraftService(page);
    await e2eData.trackContentEntity(entityId);
    await fillDraftForm(page, draft);
    await log.step("Format the body text via the real toolbar (Spec 4 AC-4.1)");
    const bodyField = page.getByRole("textbox", { name: "Metin" });
    await bodyField.selectText();
    await page.getByRole("button", { name: "Kalın" }).click();
    await expect(page.getByRole("button", { name: "Kalın" })).toHaveAttribute("aria-pressed", "true");
    await saveDraft(page, "TR");

    await log.step("Edit the saved draft before publishing");
    await page.getByLabel("Özet").fill(editedSummary);
    await saveDraft(page, "TR");
    await expect(page.getByLabel("Özet")).toHaveValue(editedSummary);

    await log.step("Publish the Turkish locale and verify the public route");
    await publish(page, "TR");

    const row = await findServiceRowByTitle(page, draft.title);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("TR");
    await expect(row).toContainText("—");

    await page.goto(`/servisler/${draft.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: draft.title })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(editedSummary);
    // Spec 4 AC-4.3: the formatting applied through the toolbar reaches the
    // public page as real markup, not raw typed tags and not escaped text.
    const bodyHtml = await page.locator("main").innerHTML();
    expect(bodyHtml).toContain(`<strong>${draft.body}</strong>`);
    expect(bodyHtml).not.toContain("&lt;strong&gt;");
    const metadata = await page.evaluate(() => {
      const description = Array.from(document.head.children).find(
        (node) => node.tagName === "META" && node.getAttribute("name") === "description",
      );
      return { title: document.title, description: description?.getAttribute("content") ?? null };
    });
    expect(metadata.title).toContain(draft.seoTitle);
    expect(metadata.description).toBe(draft.seoDescription);
    await expect(page.getByRole("main")).not.toContainText(INTERNAL_ERROR_PATTERN);
  });

  test("[P0] AC-3.1-04/05/07: an unpublished English draft renders the Turkish publication with a visible fallback notice", async ({ page, adminSeed, e2eData }) => {
    const turkish = serviceDraft("fallback-source");

    await log.step("Publish the Turkish locale and leave English as a draft");
    await login(page, adminSeed);
    await e2eData.trackContentEntity(await createDraftService(page));
    await fillDraftForm(page, turkish);
    await saveDraft(page, "TR");
    await publish(page, "TR");

    await log.step("Visit the English route and see the Turkish fallback with a visible notice");
    await page.goto(`/en/services/${turkish.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: turkish.title })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("not yet published in English");
    await expect(page.getByRole("main")).toContainText(turkish.summary);

    const fallbackMetadata = await page.evaluate(() => {
      const headChildren = Array.from(document.head.children);
      const robots = headChildren.find((node) => node.tagName === "META" && node.getAttribute("name") === "robots");
      const canonical = headChildren.find((node) => node.tagName === "LINK" && node.getAttribute("rel") === "canonical");
      return { robots: robots?.getAttribute("content") ?? "", canonical: canonical?.getAttribute("href") ?? "" };
    });
    expect(fallbackMetadata.robots).toMatch(/noindex/i);
    expect(new URL(fallbackMetadata.canonical).pathname).toBe(`/servisler/${turkish.slug}`);
    await expect(page.getByRole("main")).not.toContainText(INTERNAL_ERROR_PATTERN);
  });

  test("[P0] AC-3.1-06/07: a normalized slug collision is safe and does not move the second Service's published pointer", async ({ page, adminSeed, e2eData }) => {
    const original = serviceDraft("collision-owner");
    const contender = serviceDraft("collision-contender", { slug: original.slug });

    await log.step("Publish one Service and attempt the same normalized Turkish route from another entity");
    await login(page, adminSeed);
    await e2eData.trackContentEntity(await createDraftService(page));
    await fillDraftForm(page, original);
    await saveDraft(page, "TR");
    await publish(page, "TR");

    await e2eData.trackContentEntity(await createDraftService(page));
    await fillDraftForm(page, contender);
    await saveDraft(page, "TR");
    await page.getByRole("button", { name: "Bu dili yayınla" }).click();

    await expect(page.locator('p[role="alert"]')).toContainText("başka bir hizmet tarafından kullanılıyor");
    await expect(page.getByLabel("Başlık")).toHaveValue(contender.title);
    await expect(page.locator('input[name="slug"]')).toHaveValue(contender.slug);
    await expect(page.getByRole("main")).not.toContainText(INTERNAL_ERROR_PATTERN);

    await page.goto(`/servisler/${original.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: original.title })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(contender.title);
  });

  test("[P1] AC-3.1-05/09: the legacy Turkish prototype URL redirects to the canonical route once the Service domain is cut over", async ({ page, adminSeed, e2eData }) => {
    const draft = serviceDraft("legacy-redirect");

    await log.step("Publish a Turkish Service, then put the Service migration domain in NEW authority");
    await login(page, adminSeed);
    await e2eData.trackContentEntity(await createDraftService(page));
    await fillDraftForm(page, draft);
    await saveDraft(page, "TR");
    await publish(page, "TR");

    // Legacy migration domain registry check removed as part of Spec 4
    // (retirement of legacy tables and migration domains).
    await log.step("Visit the legacy prototype URL and follow the redirect");
    await page.goto(`/tr/services/${draft.slug}`);
    await page.waitForURL(new RegExp(`/servisler/${draft.slug}$`));
    expect(new URL(page.url()).pathname).toBe(`/servisler/${draft.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: draft.title })).toBeVisible();
  });

  test(
    "[P0] AC-3.1-06/07: unsafe double-encoded slug input is rejected without partial data or raw persistence details",
    { annotation: [{ type: "skipNetworkMonitoring" }] },
    async ({ page, adminSeed, e2eData }) => {
    const base = serviceDraft("unsafe-slug");
    const unsafe = serviceDraft("unsafe-slug", { slug: `${base.slug}%252Fchild` });

    await log.step("Save a draft with a forbidden double-encoded structural separator, then attempt to publish it");
    await login(page, adminSeed);
    await e2eData.trackContentEntity(await createDraftService(page));
    await fillDraftForm(page, unsafe);
    await saveDraft(page, "TR");
    await page.getByRole("button", { name: "Bu dili yayınla" }).click();

    await expect(page.locator('p[role="alert"]')).toContainText(/percent-encoded more than once/i);
    await expect(page.locator('input[name="slug"]')).toHaveValue(unsafe.slug);
    await expect(page.getByRole("main")).not.toContainText(INTERNAL_ERROR_PATTERN);
    await expect(page.getByRole("button", { name: "Taslağı kaydet" })).toBeEnabled();

    const response = await page.goto(`/servisler/${unsafe.slug}`);
    expect(response?.status()).toBe(404);
    },
  );
});
