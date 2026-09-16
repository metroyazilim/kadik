import type { ContentLocale, PrismaClient } from "@prisma/client";
import { getPublishedRouteCandidates } from "./route-reader";
import { resolvePublicRoute } from "./route-registry";
import type {
  FooterColumnPayload,
  NavChildPayload,
  NavItemPayload,
  NavTargetPayload,
} from "./site-settings-schema";

/**
 * Story 6.1 AC bullet 4: a navigation/footer entry that references a
 * managed content entity (`NavTargetPayload["kind"] === "collection"`) is
 * only ever safe to render publicly when that entity currently has a
 * *native* published route for the requested locale - never a draft,
 * archived, deleted, or fallback-locale route (a nav link silently landing
 * on the wrong language is exactly the "invalid hedef" this AC forbids).
 * `reason` is surfaced back to the admin editor so a broken reference
 * explains itself instead of just disappearing.
 */
export type ResolvedNavTarget =
  | Readonly<{ ok: true; url: string }>
  | Readonly<{ ok: false; reason: "missing" | "draft" | "archived" }>;

async function resolveCollectionTarget(
  client: PrismaClient,
  locale: ContentLocale,
  contentType: string,
  entityId: string,
): Promise<ResolvedNavTarget> {
  const entity = await client.contentEntity.findUnique({
    where: { id: entityId },
    select: { archived: true, contentType: true },
  });
  if (!entity || entity.contentType !== contentType) return { ok: false, reason: "missing" };
  if (entity.archived) return { ok: false, reason: "archived" };

  const translation = await client.contentTranslation.findUnique({
    where: { entityId_locale: { entityId, locale } },
    select: { publishedRevisionId: true, draftRevisionId: true },
  });
  if (!translation || !translation.publishedRevisionId) {
    return { ok: false, reason: translation?.draftRevisionId ? "draft" : "missing" };
  }

  const routes = await getPublishedRouteCandidates(client, entityId);
  const resolution = resolvePublicRoute(entityId, locale, routes);
  if (resolution.kind === "native") return { ok: true, url: resolution.url };
  return { ok: false, reason: "missing" };
}

/** Pure - `kind: "external"` never touches the database; its safety was already enforced at payload-validation time (`isSafeNullableCtaUrl`). */
export async function resolveNavTarget(
  client: PrismaClient,
  locale: ContentLocale,
  target: NavTargetPayload,
): Promise<ResolvedNavTarget> {
  if (target.kind === "external") return { ok: true, url: target.url };
  return resolveCollectionTarget(client, locale, target.contentType, target.entityId);
}

export type ResolvedNavChild = Readonly<{ id: string; label: string; resolved: ResolvedNavTarget }>;
export type ResolvedNavItem = Readonly<{
  id: string;
  label: string;
  resolved: ResolvedNavTarget;
  children: readonly ResolvedNavChild[];
}>;

/** Admin-facing status resolution (every item, resolved or not, kept - the editor shows unresolved items with their reason rather than hiding them). */
export async function resolveNavigationStatus(
  client: PrismaClient,
  locale: ContentLocale,
  items: readonly NavItemPayload[],
): Promise<readonly ResolvedNavItem[]> {
  return Promise.all(
    items.map(async (item) => ({
      id: item.id,
      label: item.label,
      resolved: await resolveNavTarget(client, locale, item.target),
      children: await Promise.all(
        item.children.map(async (child: NavChildPayload) => ({
          id: child.id,
          label: child.label,
          resolved: await resolveNavTarget(client, locale, child.target),
        })),
      ),
    })),
  );
}

export type PublicNavChild = Readonly<{ id: string; label: string; url: string }>;
export type PublicNavItem = Readonly<{ id: string; label: string; url: string; children: readonly PublicNavChild[] }>;

/**
 * Public composition (AC bullet 4's other half): only entries whose target
 * actually resolved appear; an unresolved parent with unresolved children
 * disappears entirely rather than rendering a dead link or an empty
 * dropdown. Mirrors `public-navigation.ts`'s `composeNavigation` filtering
 * discipline (Story 5.4 CAP-2) for this content type's own richer, admin-
 * authored navigation shape.
 */
export async function composePublicNavigation(
  client: PrismaClient,
  locale: ContentLocale,
  items: readonly NavItemPayload[],
): Promise<readonly PublicNavItem[]> {
  const resolved = await resolveNavigationStatus(client, locale, items);
  const out: PublicNavItem[] = [];
  for (const item of resolved) {
    const children = item.children.filter(
      (child): child is ResolvedNavChild & Readonly<{ resolved: Readonly<{ ok: true; url: string }> }> =>
        child.resolved.ok,
    );
    if (!item.resolved.ok && children.length === 0) continue;
    out.push({
      id: item.id,
      label: item.label,
      url: item.resolved.ok ? item.resolved.url : (children[0]?.resolved.url ?? "#"),
      children: children.map((child) => ({ id: child.id, label: child.label, url: child.resolved.url })),
    });
  }
  return out;
}

export type PublicFooterLink = Readonly<{ id: string; label: string; url: string }>;
export type PublicFooterColumn = Readonly<{ id: string; title: string; links: readonly PublicFooterLink[] }>;

export async function composePublicFooter(
  client: PrismaClient,
  locale: ContentLocale,
  columns: readonly FooterColumnPayload[],
): Promise<readonly PublicFooterColumn[]> {
  const out: PublicFooterColumn[] = [];
  for (const column of columns) {
    const links: PublicFooterLink[] = [];
    for (const link of column.links) {
      const resolved = await resolveNavTarget(client, locale, link.target);
      if (resolved.ok) links.push({ id: link.id, label: link.label, url: resolved.url });
    }
    if (links.length === 0) continue;
    out.push({ id: column.id, title: column.title, links });
  }
  return out;
}
