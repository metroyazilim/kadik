import "server-only";
import type { ContentLocale } from "@prisma/client";
import { prisma } from "../db";
import { resolve } from "../content-model/public-content-reader";
import { FAQ_CONTENT_TYPE, type FaqPayload } from "../content-model/payload-validation";

export type PublicFaqItem = Readonly<{ entityId: string; question: string; answer: string }>;

/** FAQ has no per-item route (an accordion on one static page, matching
 * legacy `FaqTr`'s own no-slug shape) - listing reads straight off
 * `resolve()`'s entity-scoped projection, never a route lookup. */
export async function listPublishedFaqs(locale: ContentLocale): Promise<PublicFaqItem[]> {
  const entities = await prisma.contentEntity.findMany({
    where: { contentType: FAQ_CONTENT_TYPE, archived: false },
    select: { id: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const projections = await Promise.all(
    entities.map(async ({ id }): Promise<PublicFaqItem | null> => {
      const result = await resolve(prisma, { entityId: id, contentType: FAQ_CONTENT_TYPE, requestedLocale: locale });
      if (result.emptyReason !== null || result.payload === null) return null;
      const payload = result.payload as unknown as FaqPayload;
      return { entityId: id, question: payload.question, answer: payload.answer };
    }),
  );

  return projections.filter((item): item is PublicFaqItem => item !== null);
}
