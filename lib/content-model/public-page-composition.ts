import type { ContentLocale, Prisma } from "@prisma/client";
import type { PublicProjectionEmptyReason, PublicProjectionResult } from "./public-content-reader";
import type { RouteIdentityResult } from "./public-route-resolution";

/**
 * The one and only page-title formatting function for public surfaces
 * (this session's directive). Produces exactly `${plainTitle} |
 * Metroyazılım` - never a hyphen, en dash, em dash, or double-hyphen
 * separator. Epic 6's metadata assembly (Story 6.2) reuses this verbatim
 * rather than concatenating a second, independently formatted title
 * string. `plainTitle` MUST already be a plain, locale-resolved microcopy/
 * title string - an entity's own `title` field for a native/fallback
 * state, or a locale dictionary's resolved heading text for a
 * `titleKey`-carrying 404/empty state below - NEVER a user-authored
 * rich-text field (`body`/`summary`/`description`); this function performs
 * no HTML stripping of its own.
 */
const SITE_TITLE_SUFFIX = "Metroyazılım";
const TITLE_SEPARATOR = " | ";

export function formatPageTitle(plainTitle: string): string {
  const trimmed = plainTitle.trim();
  if (trimmed.length === 0) return SITE_TITLE_SUFFIX;
  return `${trimmed}${TITLE_SEPARATOR}${SITE_TITLE_SUFFIX}`;
}

/** Turkish renders at the prefixless root; every other locale keeps its own
 * URL prefix (AD-6, `AGENTS.md`'s public URL contract) - this module's only
 * dependency on that rule, needed solely to build a safe-state recovery
 * link, never to construct a content route (that stays Story 0.4/5.2's
 * `generateRoute`/`resolvePublicRoute` job exclusively). */
function homeUrlFor(locale: ContentLocale): string {
  return locale === "tr" ? "/" : `/${locale}`;
}

export type CollectionViewItem = Readonly<{
  entityId: string;
  servedLocale: ContentLocale;
  fallbackApplied: boolean;
  payload: Prisma.JsonValue;
}>;

export type CollectionEmptyState = Readonly<{
  titleKey: string;
  h1Key: string;
  microcopyKey: string;
  recoveryLinkTarget: string;
}>;

export type CollectionView = Readonly<{
  requestedLocale: ContentLocale;
  items: readonly CollectionViewItem[];
  isEmpty: boolean;
  /** Populated only when `isEmpty` - AC-5.3-04 requires the empty-collection
   * state to carry its own document title/h1, never satisfied by an
   * in-page status announcement alone. */
  emptyState: CollectionEmptyState | null;
}>;

const COLLECTION_EMPTY_TITLE_KEY = "public.collection.empty.title";
const COLLECTION_EMPTY_H1_KEY = "public.collection.empty.heading";

/**
 * Story 5.3 CAP-1: turns a list of Story 5.1 `PublicProjectionResult`s into
 * a render-ready collection view, mirroring AD-7's "an unrenderable section
 * never renders" discipline applied to list items. Only entries with a
 * non-null payload and no `emptyReason` survive, in the input's own stable
 * order - never re-sorted, never throwing on an all-empty input. An
 * all-empty result carries its own `emptyState` (AC-5.3-04), never a bare
 * `{ items: [] }` with nothing for the page to render.
 */
export function composeCollectionView(
  items: readonly PublicProjectionResult[],
  requestedLocale: ContentLocale,
  collectionFallbackUrl: string | null = null,
): CollectionView {
  const renderable: CollectionViewItem[] = [];
  for (const item of items) {
    if (item.emptyReason === null && item.payload !== null && item.servedLocale !== null) {
      renderable.push({
        entityId: item.entityId,
        servedLocale: item.servedLocale,
        fallbackApplied: item.fallbackApplied,
        payload: item.payload,
      });
    }
  }

  if (renderable.length > 0) {
    return { requestedLocale, items: renderable, isEmpty: false, emptyState: null };
  }

  const microcopy = selectMicrocopy("no-published-any-locale", requestedLocale, collectionFallbackUrl);
  return {
    requestedLocale,
    items: renderable,
    isEmpty: true,
    emptyState: {
      titleKey: COLLECTION_EMPTY_TITLE_KEY,
      h1Key: COLLECTION_EMPTY_H1_KEY,
      microcopyKey: microcopy.microcopyKey,
      recoveryLinkTarget: microcopy.recoveryLinkTarget,
    },
  };
}

export type BidiDirective = Readonly<{ lang: "tr"; dir: "ltr" }>;

export type HreflangAlternate = Readonly<{ locale: ContentLocale; url: string }>;

/** The canonical/noindex/hreflang directive set every full-page-navigation
 * state carries (AC-5.3-06) - never a component or markup decision, only
 * the data a future metadata/component layer needs. */
export type PageDirectives = Readonly<{
  canonical: string | null;
  noindex: boolean;
  hreflangAlternates: readonly HreflangAlternate[];
}>;

/**
 * `pageTitle`/`h1` on the content-bearing states are the caller-extracted
 * plain title field, ready for `formatPageTitle`. `titleKey`/`h1Key` on the
 * no-content states are locale dictionary keys, never a hardcoded literal
 * string in one language - per this story's own Assumption that literal
 * microcopy text is a locale-dictionary implementation input, not
 * something this pure composer invents. Both pairs are mutually exclusive
 * by construction (the discriminated union), never both present at once.
 */
export type DetailViewState =
  | Readonly<{
      state: "native";
      entityId: string;
      payload: Prisma.JsonValue;
      pageTitle: string;
      directives: PageDirectives;
    }>
  | Readonly<{
      state: "fallback";
      entityId: string;
      payload: Prisma.JsonValue;
      pageTitle: string;
      content: BidiDirective;
      fallbackNoticeFirst: true;
      directives: PageDirectives;
    }>
  | Readonly<{
      state: "notFound";
      titleKey: string;
      h1Key: string;
      microcopyKey: string;
      recoveryLinkTarget: string;
      directives: PageDirectives;
    }>
  | Readonly<{
      state: "empty";
      titleKey: string;
      h1Key: string;
      microcopyKey: string;
      recoveryLinkTarget: string;
      directives: PageDirectives;
    }>;

export type DetailContext = Readonly<{
  /** Story 5.2's reverse-lookup result, or the one `LegacyResolution`
   * outcome a detail page can safely compose on its own -
   * `{ kind: "collection"; url }`. A `redirect` `LegacyResolution` is never
   * passed here per its own contract - the caller issues that redirect
   * itself and never calls `composeDetailView` (Story 5.2's own note). */
  routeResult: RouteIdentityResult | Readonly<{ kind: "collection"; url: string }>;
  /** `null` only when `routeResult.kind` is itself not `native`/
   * `fallbackAlias` - a route that resolved to an entity always carries a
   * content result. */
  contentResult: PublicProjectionResult | null;
  /** The plain title field the caller extracted from `contentResult.payload`
   * (per content type) - required whenever a content-bearing state is
   * possible, ignored otherwise. Never a rich-text field. */
  pageTitle: string | null;
  requestedLocale: ContentLocale;
  /** This content type's own collection-page URL in `requestedLocale`, if
   * one exists - passed straight through to `selectMicrocopy`'s recovery-
   * target preference, never resolved by this module itself. */
  collectionFallbackUrl: string | null;
  /** This entity's own published routes across every locale it has one in
   * (native + any fallback-alias address), already resolved by the caller
   * via Story 5.2's `resolveRouteIdentity`/`resolvePublicRoute` - never
   * recomputed here (this module accepts only already-resolved route/
   * content values, per this story's own purity constraint). Omitted
   * locales are simply absent from the array, never filled with a guessed
   * URL. */
  hreflangAlternates?: readonly HreflangAlternate[];
}>;

const NOT_FOUND_TITLE_KEY = "public.notFound.title";
const NOT_FOUND_H1_KEY = "public.notFound.heading";
const EMPTY_TITLE_KEY = "public.empty.title";
const EMPTY_H1_KEY = "public.empty.heading";

/**
 * Total, closed-union-safe mapping from an `emptyReason` to a microcopy
 * key - fails closed to the generic safe not-found copy for any value
 * outside today's union, rather than throwing (AC-5.3-05).
 */
const EMPTY_REASON_MICROCOPY: Readonly<Record<PublicProjectionEmptyReason, string>> = {
  "no-entity": "public.notFound.contentUnavailable",
  "no-translation": "public.notFound.contentUnavailable",
  "no-published-any-locale": "public.notFound.contentUnavailable",
  "source-error": "public.error.generic",
};

const GENERIC_NOT_FOUND_MICROCOPY = "public.notFound.generic";

/** Classifications whose recovery-link target prefers this content type's
 * own collection page over the generic home page, when one is supplied -
 * a more specific, more useful recovery path when one exists, per
 * `EXPERIENCE.md`'s "en az bir kurtarma yolu" rule. */
const COLLECTION_PREFERRED_CLASSIFICATIONS: ReadonlySet<string> = new Set([
  "no-published-any-locale",
  "routeNotFound",
  "routeCollectionOnly",
]);

/**
 * Total over every `emptyReason`/route-classification value this story's
 * closed unions define - fails closed to the generic safe not-found copy
 * and a locale-correct home recovery link for anything else (AC-5.3-05),
 * never throwing and never an empty string.
 */
export function selectMicrocopy(
  classification: PublicProjectionEmptyReason | RouteIdentityResult["kind"] | "routeCollectionOnly" | string,
  requestedLocale: ContentLocale,
  collectionFallbackUrl: string | null = null,
): Readonly<{ microcopyKey: string; recoveryLinkTarget: string }> {
  const key = EMPTY_REASON_MICROCOPY[classification as PublicProjectionEmptyReason];
  const microcopyKey = key ?? GENERIC_NOT_FOUND_MICROCOPY;
  const prefersCollection =
    collectionFallbackUrl !== null && COLLECTION_PREFERRED_CLASSIFICATIONS.has(classification);
  return {
    microcopyKey,
    recoveryLinkTarget: prefersCollection ? collectionFallbackUrl : homeUrlFor(requestedLocale),
  };
}

/**
 * Story 5.3 CAP-2/CAP-3: selects exactly one of native/fallback/404/empty
 * and produces that state's own directive set - never two states at once
 * (AC-5.3-02), never any new markup or component (AC-5.3-06). A
 * `fallbackAlias` route always yields `{ lang: "tr", dir: "ltr" }` for its
 * content block regardless of the shell's own direction, with the fallback
 * notice marked to precede the content block in document order
 * (AC-5.3-03). Every full-page-navigation state (404, empty, fallback)
 * carries its own title/h1 directive, never satisfied by an in-page status
 * announcement alone (AC-5.3-04).
 */
export function composeDetailView(context: DetailContext): DetailViewState {
  const { routeResult, contentResult, pageTitle, requestedLocale, collectionFallbackUrl } = context;
  const hreflangAlternates = context.hreflangAlternates ?? [];

  if (
    routeResult.kind === "notFound" ||
    routeResult.kind === "invalidInput" ||
    routeResult.kind === "collection"
  ) {
    const classification = routeResult.kind === "collection" ? "routeCollectionOnly" : "routeNotFound";
    const microcopy = selectMicrocopy(classification, requestedLocale, collectionFallbackUrl);
    return {
      state: "notFound",
      titleKey: NOT_FOUND_TITLE_KEY,
      h1Key: NOT_FOUND_H1_KEY,
      microcopyKey: microcopy.microcopyKey,
      recoveryLinkTarget: microcopy.recoveryLinkTarget,
      directives: { canonical: null, noindex: true, hreflangAlternates: [] },
    };
  }

  if (!contentResult || contentResult.emptyReason !== null || contentResult.payload === null) {
    const classification = contentResult?.emptyReason ?? "no-entity";
    const microcopy = selectMicrocopy(classification, requestedLocale, collectionFallbackUrl);
    return {
      state: "empty",
      titleKey: EMPTY_TITLE_KEY,
      h1Key: EMPTY_H1_KEY,
      microcopyKey: microcopy.microcopyKey,
      recoveryLinkTarget: microcopy.recoveryLinkTarget,
      directives: { canonical: null, noindex: true, hreflangAlternates },
    };
  }

  const resolvedPageTitle = pageTitle ?? "";

  if (routeResult.kind === "fallbackAlias") {
    return {
      state: "fallback",
      entityId: routeResult.entityId,
      payload: contentResult.payload,
      pageTitle: resolvedPageTitle,
      content: { lang: "tr", dir: "ltr" },
      fallbackNoticeFirst: true,
      directives: { canonical: routeResult.canonical, noindex: true, hreflangAlternates },
    };
  }

  return {
    state: "native",
    entityId: routeResult.entityId,
    payload: contentResult.payload,
    pageTitle: resolvedPageTitle,
    directives: { canonical: null, noindex: false, hreflangAlternates },
  };
}
