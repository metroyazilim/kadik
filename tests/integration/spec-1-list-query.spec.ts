import type { Prisma } from "@prisma/client";
import { expect, test } from "../support/merged-fixtures";
import {
  COLLECTION_PAGE_SIZE,
  createCollectionEntity,
  ensureLocaleTranslation,
  listCollectionPage,
} from "../../lib/content-model/collection-admin";
import { adminSaveDraft } from "../../lib/content-model/admin-content-store";

// Spec 1 AC-6: an admin list page reads one page of entities and only the
// display locale's payload instead of both full locale revisions.

const SERVICE_CONTENT_TYPE = "service";
const SERVICE_SCHEMA_VERSION = 2;

function servicePayload(title: string, slug: string) {
  return {
    title,
    slug,
    summary: `${title} summary`,
    blocks: [{ id: "b1", type: "text", html: `<p>${title} body</p>` }],
    icon: null,
    imageAssetId: null,
    seoTitle: null,
    seoDescription: null,
  } as unknown as Prisma.InputJsonValue;
}

test.describe("listCollectionPage", () => {
  test("AC-6: pages the entity read and carries payload only for the display locale", async ({ e2eData }) => {
    const client = e2eData.client;
    const actor = await e2eData.createAdminActor("spec-1-list-query");

    const ids: string[] = [];
    for (const marker of ["alpha", "beta"]) {
      const { entityId } = await createCollectionEntity(client, actor, SERVICE_CONTENT_TYPE);
      await e2eData.trackContentEntity(entityId);
      ids.push(entityId);
      for (const locale of ["tr", "en"] as const) {
        const { translationId, version } = await ensureLocaleTranslation(client, actor, entityId, locale);
        const result = await adminSaveDraft(client, actor, {
          translationId,
          expectedVersion: version,
          schemaVersion: SERVICE_SCHEMA_VERSION,
          payload: servicePayload(`${marker}-${locale}`, `spec-1-${marker}-${locale}-${entityId.slice(0, 6)}`),
        });
        if (!result.ok) throw new Error("draft save unexpectedly conflicted");
      }
    }

    const firstPage = await listCollectionPage(client, SERVICE_CONTENT_TYPE, { page: 1, perPage: 1 });
    expect(firstPage.rows).toHaveLength(1);
    expect(firstPage.perPage).toBe(1);
    expect(firstPage.total).toBeGreaterThanOrEqual(2);

    const secondPage = await listCollectionPage(client, SERVICE_CONTENT_TYPE, { page: 2, perPage: 1 });
    expect(secondPage.rows[0]?.entityId).not.toBe(firstPage.rows[0]?.entityId);

    // An out-of-range or malformed page never throws and never silently
    // returns page 1's rows as if they were page 9's.
    const beyondEnd = await listCollectionPage(client, SERVICE_CONTENT_TYPE, { page: 9999, perPage: 1 });
    expect(beyondEnd.rows).toHaveLength(0);
    expect(beyondEnd.total).toBe(firstPage.total);

    const turkishView = await listCollectionPage(client, SERVICE_CONTENT_TYPE, { perPage: 200 });
    const turkishRow = turkishView.rows.find((row) => row.entityId === ids[0]);
    expect(turkishRow).toBeDefined();
    // Both canonical locales report their own status while exactly one
    // payload - the display locale's - is loaded.
    expect(turkishRow?.statuses.tr).toBe("draft");
    expect(turkishRow?.statuses.en).toBe("draft");
    expect((turkishRow?.displayPayload as { title?: string } | null)?.title).toBe("alpha-tr");

    const englishView = await listCollectionPage(client, SERVICE_CONTENT_TYPE, { perPage: 200, displayLocale: "en" });
    const englishRow = englishView.rows.find((row) => row.entityId === ids[0]);
    expect((englishRow?.displayPayload as { title?: string } | null)?.title).toBe("alpha-en");

    // The default page size is one screenful, not the whole table.
    expect(COLLECTION_PAGE_SIZE).toBe(20);
    const defaultPage = await listCollectionPage(client, SERVICE_CONTENT_TYPE);
    expect(defaultPage.rows.length).toBeLessThanOrEqual(COLLECTION_PAGE_SIZE);
  });
});
