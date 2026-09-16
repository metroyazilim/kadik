import "server-only";
import type { ContentLocale } from "@prisma/client";
import { listPublishedServices } from "./service";
import { listPublishedProducts } from "./product";
import { listPublishedProjects } from "./project";
import { listPublishedTeamMembers } from "./team";
import { listPublishedPosts } from "./post";
import { listPublishedFaqs } from "./faq";
import { generateRoute } from "../content-model/route-registry";
import { teamMemberRouteCandidate } from "../content-model/team-routes";
import type { HomeCollectionSource } from "../content-model/home-section-schemas";

/**
 * The single card shape every collection Part consumes. Each source maps its
 * own payload onto these fields, so a section can be pointed at any
 * collection without the renderer knowing which one it got - that is what
 * makes "bu blok hangi koleksiyonu listeleyecek" an admin choice rather
 * than a per-section hardcoded binding.
 *
 * `publishedAt` is what `selectionMode: "latest"` orders by; `category` is
 * what `selectionMode: "category"` filters on. A source with no natural
 * category (team, faq) reports its secondary line there instead, so the
 * filter still has something meaningful to match.
 */
export type HomeCollectionCard = Readonly<{
  entityId: string;
  title: string;
  summary: string;
  category: string;
  image: string | null;
  icon: string | null;
  href: string;
  publishedAt: Date | null;
  /** Yalnızca `team` kaynağı doldurur; diğer koleksiyonların sosyal hesabı yoktur. */
  social: Readonly<{ instagram: string | null; linkedin: string | null }> | null;
}>;

export async function listHomeCollectionCards(
  source: HomeCollectionSource,
  locale: ContentLocale,
): Promise<readonly HomeCollectionCard[]> {
  switch (source) {
    case "services": {
      const rows = await listPublishedServices(locale);
      return rows.map((row) => ({
        entityId: row.entityId,
        title: row.title,
        summary: row.summary,
        category: "",
        image: row.image.url || null,
        icon: row.icon,
        href: `/${locale}/services/${row.slug}`,
        publishedAt: null,
        social: null,
      }));
    }

    case "products": {
      const rows = await listPublishedProducts(locale);
      return rows.map((row) => ({
        entityId: row.entityId,
        title: row.title,
        summary: row.summary,
        category: row.badge ?? "",
        image: row.image.url || null,
        icon: null,
        href: `/${locale}/products/${row.slug}`,
        publishedAt: null,
        social: null,
      }));
    }

    case "projects": {
      const rows = await listPublishedProjects(locale);
      return rows.map((row) => ({
        entityId: row.entityId,
        title: row.title,
        summary: row.category,
        category: row.category,
        image: row.coverImage.url || null,
        icon: null,
        href: `/${locale}/projects/${row.slug}`,
        publishedAt: null,
        social: null,
      }));
    }

    case "team": {
      const rows = await listPublishedTeamMembers(locale);
      return rows.map((row) => ({
        entityId: row.entityId,
        title: row.name,
        summary: row.role,
        category: row.role,
        image: row.image.url || null,
        icon: null,
        href: generateRoute(teamMemberRouteCandidate(locale, row.slug)),
        publishedAt: null,
        social: row.social,
      }));
    }

    case "posts": {
      const rows = await listPublishedPosts(locale);
      return rows.map((row) => ({
        entityId: row.entityId,
        title: row.title,
        summary: row.excerpt,
        category: row.category,
        image: row.coverImage.url || null,
        icon: null,
        href: `/${locale}/blog/${row.slug}`,
        publishedAt: row.publishedAt,
        social: null,
      }));
    }

    case "faq": {
      const rows = await listPublishedFaqs(locale);
      return rows.map((row) => ({
        entityId: row.entityId,
        title: row.question,
        summary: row.answer,
        category: "",
        image: null,
        icon: null,
        href: `/${locale}/faq`,
        publishedAt: null,
        social: null,
      }));
    }
  }
}

/**
 * Applies the admin's selection rule. `manual` preserves the admin's own
 * click order (not the collection's), because the picked order is the whole
 * point of picking manually.
 */
export function selectHomeCollectionCards(
  cards: readonly HomeCollectionCard[],
  options: Readonly<{
    mode: "latest" | "manual" | "category";
    selectedEntityIds?: readonly string[];
    categories?: readonly string[];
    limit: number;
  }>,
): readonly HomeCollectionCard[] {
  if (options.mode === "manual") {
    const ids = options.selectedEntityIds ?? [];
    const byId = new Map(cards.map((card) => [card.entityId, card]));
    return ids.flatMap((id) => {
      const found = byId.get(id);
      return found ? [found] : [];
    }).slice(0, options.limit);
  }

  if (options.mode === "category") {
    const wanted = new Set((options.categories ?? []).map((value) => value.toLocaleLowerCase("tr")));
    if (wanted.size === 0) return cards.slice(0, options.limit);
    return cards
      .filter((card) => wanted.has(card.category.toLocaleLowerCase("tr")))
      .slice(0, options.limit);
  }

  // latest: newest publication first when the source carries a date, else
  // the collection's own admin-controlled order.
  const hasDates = cards.some((card) => card.publishedAt !== null);
  const ordered = hasDates
    ? [...cards].sort(
        (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      )
    : cards;
  return ordered.slice(0, options.limit);
}
