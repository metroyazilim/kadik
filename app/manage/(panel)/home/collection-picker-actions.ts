"use server";

import type { ContentLocale } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import type { HomeCollectionSource } from "@/lib/content-model/home-section-schemas";
import {
  SERVICE_CONTENT_TYPE,
  PRODUCT_CONTENT_TYPE,
  PROJECT_CONTENT_TYPE,
  TEAM_MEMBER_CONTENT_TYPE,
  POST_CONTENT_TYPE,
  FAQ_CONTENT_TYPE,
} from "@/lib/content-model/payload-validation";

const CONTENT_TYPE_BY_SOURCE: Readonly<Record<HomeCollectionSource, string>> = {
  services: SERVICE_CONTENT_TYPE,
  products: PRODUCT_CONTENT_TYPE,
  projects: PROJECT_CONTENT_TYPE,
  team: TEAM_MEMBER_CONTENT_TYPE,
  posts: POST_CONTENT_TYPE,
  faq: FAQ_CONTENT_TYPE,
};

export type SelectableCollectionItem = Readonly<{
  id: string;
  title: string;
  category: string;
}>;

export type CollectionPickerResult = Readonly<{
  items: readonly SelectableCollectionItem[];
  /** Distinct, non-empty categories present in this source - what the
   * "kategoriye göre" selection mode offers as checkboxes. */
  categories: readonly string[];
}>;

/** Reads the admin-side working copy (draft preferred) so a record the admin
 * just created is pickable immediately, before it is published. */
function titleAndCategoryOf(
  source: HomeCollectionSource,
  payload: Record<string, unknown> | null,
  fallbackId: string,
): Readonly<{ title: string; category: string }> {
  const text = (key: string): string => {
    const value = payload?.[key];
    return typeof value === "string" ? value : "";
  };

  switch (source) {
    case "team":
      return { title: text("name") || `Kayıt #${fallbackId.slice(-4)}`, category: text("role") };
    case "faq":
      return { title: text("question") || `Soru #${fallbackId.slice(-4)}`, category: "" };
    case "products":
      return { title: text("title") || `Kayıt #${fallbackId.slice(-4)}`, category: text("badge") };
    default:
      return { title: text("title") || `Kayıt #${fallbackId.slice(-4)}`, category: text("category") };
  }
}

export async function getCollectionSelectableItemsAction(
  source: HomeCollectionSource,
  locale: ContentLocale,
): Promise<CollectionPickerResult> {
  await resolveAdminContext();

  const contentType = CONTENT_TYPE_BY_SOURCE[source];
  if (!contentType) return { items: [], categories: [] };

  const entities = await prisma.contentEntity.findMany({
    where: { contentType, archived: false },
    include: {
      translations: {
        where: { locale },
        include: { draftRevision: true, publishedRevision: true },
      },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const items = entities.map((entity) => {
    const translation = entity.translations[0];
    const rawPayload =
      translation?.draftRevision?.payload ?? translation?.publishedRevision?.payload ?? null;
    const payload =
      rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : null;
    const { title, category } = titleAndCategoryOf(source, payload, entity.id);
    return { id: entity.id, title, category };
  });

  const categories = [...new Set(items.map((item) => item.category).filter((value) => value.length > 0))].sort();

  return { items, categories };
}
