import { expect, test } from "@playwright/test";
import {
  composeCollectionView,
  composeDetailView,
  formatPageTitle,
  selectMicrocopy,
  type DetailContext,
} from "../../lib/content-model/public-page-composition";
import type { PublicProjectionResult } from "../../lib/content-model/public-content-reader";
import type { RouteIdentityResult } from "../../lib/content-model/public-route-resolution";

function projection(overrides: Partial<PublicProjectionResult> = {}): PublicProjectionResult {
  return {
    entityId: "ent-1",
    contentType: "service",
    requestedLocale: "en",
    servedLocale: "en",
    servedRevisionId: "rev-1",
    fallbackApplied: false,
    payload: { title: "Waste Audit" },
    canonical: null,
    cacheDependencies: { tags: [] },
    emptyReason: null,
    ...overrides,
  };
}

test.describe("Story 5.3 Unit - title format contract (this session's directive)", () => {
  test("formatPageTitle produces exactly '<title> | Metroyazılım'", () => {
    expect(formatPageTitle("Atık Denetimi")).toBe("Atık Denetimi | Metroyazılım");
  });

  test("formatPageTitle never introduces a hyphen, en dash, or em dash separator", () => {
    const result = formatPageTitle("Some Title");
    expect(result).not.toContain(" - ");
    expect(result).not.toContain("–");
    expect(result).not.toContain("—");
    expect(result).not.toContain("--");
  });

  test("formatPageTitle trims whitespace and falls back to the bare suffix for an empty title", () => {
    expect(formatPageTitle("  ")).toBe("Metroyazılım");
    expect(formatPageTitle("  Padded  ")).toBe("Padded | Metroyazılım");
  });
});

test.describe("AC-5.3-01 - collection renders only renderable items", () => {
  test("CAP-1 only entries with a non-null payload and no emptyReason survive, in stable order", () => {
    const items: PublicProjectionResult[] = [
      projection({ entityId: "a" }),
      projection({ entityId: "b", payload: null, emptyReason: "no-published-any-locale", servedLocale: null }),
      projection({ entityId: "c" }),
    ];
    const view = composeCollectionView(items, "en");
    expect(view.items.map((i) => i.entityId)).toEqual(["a", "c"]);
    expect(view.isEmpty).toBe(false);
    expect(view.emptyState).toBeNull();
    expect(view.requestedLocale).toBe("en");
  });

  test("CAP-1 a renderable item carries its own servedLocale/fallbackApplied, not just entityId/payload", () => {
    const view = composeCollectionView(
      [projection({ entityId: "a", servedLocale: "tr", fallbackApplied: true })],
      "en",
    );
    expect(view.items).toEqual([
      { entityId: "a", servedLocale: "tr", fallbackApplied: true, payload: { title: "Waste Audit" } },
    ]);
  });
});

test.describe("AC-5.3-04 (collection) - empty collection carries its own title/h1, never a bare items:[]", () => {
  test("CAP-1/CAP-3 an all-empty input returns an explicit empty-collection view with title/h1/microcopy/recovery, not an exception or null array", () => {
    const view = composeCollectionView(
      [projection({ payload: null, emptyReason: "no-published-any-locale", servedLocale: null })],
      "en",
    );
    expect(view.items).toEqual([]);
    expect(view.isEmpty).toBe(true);
    expect(view.emptyState).toEqual({
      titleKey: "public.collection.empty.title",
      h1Key: "public.collection.empty.heading",
      microcopyKey: "public.notFound.contentUnavailable",
      recoveryLinkTarget: "/en",
    });
  });

  test("CAP-3 an empty collection prefers its own collection URL as recovery target when supplied", () => {
    const view = composeCollectionView([], "en", "/en/services");
    expect(view.emptyState?.recoveryLinkTarget).toBe("/en/services");
  });

  test("CAP-3 the empty-collection recovery target is locale-correct - Turkish is prefixless, others keep their prefix", () => {
    expect(composeCollectionView([], "tr").emptyState?.recoveryLinkTarget).toBe("/");
    expect(composeCollectionView([], "en").emptyState?.recoveryLinkTarget).toBe("/en");
  });
});

test.describe("AC-5.3-02 - single detail state, never two at once", () => {
  test("CAP-2 a native route with a resolved content result yields exactly the native state", () => {
    const routeResult: RouteIdentityResult = { kind: "native", entityId: "ent-1", url: "/en/services/x" };
    const context: DetailContext = {
      routeResult,
      contentResult: projection(),
      pageTitle: "Waste Audit",
      requestedLocale: "en",
      collectionFallbackUrl: null,
    };
    const view = composeDetailView(context);
    expect(view.state).toBe("native");
    expect("microcopyKey" in view).toBe(false);
    if (view.state !== "native") throw new Error("expected native");
    expect(view.directives).toEqual({ canonical: null, noindex: false, hreflangAlternates: [] });
  });

  test("CAP-2 a notFound route never carries a content payload alongside its not-found marker", () => {
    const context: DetailContext = {
      routeResult: { kind: "notFound" },
      contentResult: null,
      pageTitle: null,
      requestedLocale: "en",
      collectionFallbackUrl: null,
    };
    const view = composeDetailView(context);
    expect(view.state).toBe("notFound");
    expect("payload" in view).toBe(false);
    if (view.state !== "notFound") throw new Error("expected notFound");
    expect(view.directives.noindex).toBe(true);
    expect(view.directives.canonical).toBeNull();
  });

  test("CAP-2 a LegacyResolution 'collection' route classification also composes as a safe notFound page state", () => {
    const view = composeDetailView({
      routeResult: { kind: "collection", url: "/en/services" },
      contentResult: null,
      pageTitle: null,
      requestedLocale: "en",
      collectionFallbackUrl: "/en/services",
    });
    expect(view.state).toBe("notFound");
    if (view.state !== "notFound") throw new Error("expected notFound");
    expect(view.recoveryLinkTarget).toBe("/en/services");
  });
});

test.describe("AC-5.3-03 - fallback bidi isolation and ordering", () => {
  test("CAP-2 a fallbackAlias route always yields { lang: 'tr', dir: 'ltr' } and marks the fallback notice first", () => {
    const routeResult: RouteIdentityResult = {
      kind: "fallbackAlias",
      entityId: "ent-2",
      canonical: "/servisler/atik-denetimi",
      noindex: true,
    };
    const context: DetailContext = {
      routeResult,
      contentResult: projection({ fallbackApplied: true, servedLocale: "tr" }),
      pageTitle: "Atık Denetimi",
      requestedLocale: "en",
      collectionFallbackUrl: null,
    };
    const view = composeDetailView(context);
    if (view.state !== "fallback") throw new Error("expected fallback state");
    expect(view.content).toEqual({ lang: "tr", dir: "ltr" });
    expect(view.fallbackNoticeFirst).toBe(true);
    expect(view.directives.noindex).toBe(true);
    expect(view.directives.canonical).toBe("/servisler/atik-denetimi");
  });
});

test.describe("AC-5.3-04 - full-page-navigation title/h1 contract", () => {
  test("CAP-2/CAP-3 notFound, empty, and fallback states each carry their own title/heading directive", () => {
    const notFound = composeDetailView({
      routeResult: { kind: "notFound" },
      contentResult: null,
      pageTitle: null,
      requestedLocale: "en",
      collectionFallbackUrl: null,
    });
    const empty = composeDetailView({
      routeResult: { kind: "native", entityId: "ent-3", url: "/en/services/y" },
      contentResult: projection({ payload: null, emptyReason: "no-published-any-locale", servedLocale: null }),
      pageTitle: null,
      requestedLocale: "en",
      collectionFallbackUrl: null,
    });
    const fallback = composeDetailView({
      routeResult: { kind: "fallbackAlias", entityId: "ent-2", canonical: "/servisler/x", noindex: true },
      contentResult: projection({ fallbackApplied: true }),
      pageTitle: "X",
      requestedLocale: "en",
      collectionFallbackUrl: null,
    });

    if (notFound.state !== "notFound") throw new Error("expected notFound");
    if (empty.state !== "empty") throw new Error("expected empty");
    if (fallback.state !== "fallback") throw new Error("expected fallback");

    expect(notFound.titleKey).toBe("public.notFound.title");
    expect(notFound.h1Key).toBe("public.notFound.heading");
    expect(empty.titleKey).toBe("public.empty.title");
    expect(empty.h1Key).toBe("public.empty.heading");
    expect(notFound.titleKey).not.toBe(empty.titleKey);
    expect(notFound.h1Key).not.toBe(empty.h1Key);
    expect(fallback.pageTitle).toBe("X");
  });

  test("CAP-2 hreflangAlternates passes through from caller-supplied input, populated on every state that carries directives", () => {
    const alternates = [{ locale: "en" as const, url: "/en/services/x" }];
    const view = composeDetailView({
      routeResult: { kind: "native", entityId: "ent-1", url: "/en/services/x" },
      contentResult: projection(),
      pageTitle: "X",
      requestedLocale: "en",
      collectionFallbackUrl: null,
      hreflangAlternates: alternates,
    });
    if (view.state !== "native") throw new Error("expected native");
    expect(view.directives.hreflangAlternates).toEqual(alternates);
  });
});

test.describe("AC-5.3-05 - total, closed-union-safe empty/error microcopy", () => {
  test("CAP-3 every currently-defined emptyReason value maps to its own exact microcopy key", () => {
    expect(selectMicrocopy("no-entity", "en", null).microcopyKey).toBe("public.notFound.contentUnavailable");
    expect(selectMicrocopy("no-translation", "en", null).microcopyKey).toBe(
      "public.notFound.contentUnavailable",
    );
    expect(selectMicrocopy("no-published-any-locale", "en", null).microcopyKey).toBe(
      "public.notFound.contentUnavailable",
    );
    expect(selectMicrocopy("source-error", "en", null).microcopyKey).toBe("public.error.generic");
  });

  test("CAP-3 a storage failure is never presented as merely missing content, and vice versa", () => {
    expect(selectMicrocopy("source-error", "en", null).microcopyKey).not.toBe(
      selectMicrocopy("no-published-any-locale", "en", null).microcopyKey,
    );
  });

  test("CAP-3 a value outside today's closed union fails closed to the generic safe not-found copy and a locale-correct home recovery link", () => {
    expect(selectMicrocopy("some-hypothetical-future-value", "en", null)).toEqual({
      microcopyKey: "public.notFound.generic",
      recoveryLinkTarget: "/en",
    });
    expect(selectMicrocopy("some-hypothetical-future-value", "tr", null).recoveryLinkTarget).toBe("/");
  });

  test("CAP-3 a collection recovery URL is preferred only for classifications a collection page can meaningfully recover from", () => {
    expect(selectMicrocopy("no-published-any-locale", "en", "/en/services").recoveryLinkTarget).toBe(
      "/en/services",
    );
    expect(selectMicrocopy("routeNotFound", "en", "/en/services").recoveryLinkTarget).toBe(
      "/en/services",
    );
    // no-entity/source-error are not in the collection-preferred set - home wins even with a URL supplied.
    expect(selectMicrocopy("no-entity", "en", "/en/services").recoveryLinkTarget).toBe("/en");
    expect(selectMicrocopy("source-error", "en", "/en/services").recoveryLinkTarget).toBe("/en");
  });
});

test.describe("AC-5.3-06 - no component/markup invented", () => {
  test("CAP-2/CAP-3 composeDetailView's output never contains an HTML tag or React element - state/directive data only", () => {
    const view = composeDetailView({
      routeResult: { kind: "native", entityId: "ent-1", url: "/en/services/x" },
      contentResult: projection(),
      pageTitle: "Waste Audit",
      requestedLocale: "en",
      collectionFallbackUrl: null,
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/<[a-z]+[\s>]/i);
  });
});
