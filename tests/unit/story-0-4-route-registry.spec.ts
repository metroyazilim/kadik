import { expect, test } from "@playwright/test";
import { ContentModelError } from "../../lib/content-model/errors";
import {
  generateRoute,
  normalizeRouteSegment,
  resolvePublicRoute,
  type PublishedRoute,
} from "../../lib/content-model/route-registry";

const SEGMENTS = {
  tr: "servisler",
  en: "services",
} as const;

const ENTITY_A = "entity-a";
const ENTITY_B = "entity-b";

test.describe("Story 0.4 route generation (AC-0.4-01)", () => {
  test("CAP-1 generateRoute produces prefixless Turkish and Global English routes", () => {
    expect(
      generateRoute({ contentType: "Service", locale: "tr", collectionSegment: SEGMENTS.tr, slug: "atik-denetimi" }),
    ).toBe("/servisler/atik-denetimi");
    expect(
      generateRoute({ contentType: "Service", locale: "en", collectionSegment: SEGMENTS.en, slug: "waste-audit" }),
    ).toBe("/en/services/waste-audit");
  });

  test("CAP-1 normalizeRouteSegment NFC-normalizes and accepts well-formed native-script text", () => {
    // NFD-decomposed "atık" (a + combining breve) must normalize to the
    // same result as its NFC precomposed form.
    const nfd = "atık".normalize("NFD");
    const nfc = "atık".normalize("NFC");
    expect(normalizeRouteSegment("tr", "slug", nfd)).toBe(nfc);
  });

  test("CAP-1 normalizeRouteSegment rejects an empty segment", () => {
    expect(() => normalizeRouteSegment("tr", "slug", "")).toThrow(ContentModelError);
  });

  test("CAP-1 generateRoute itself rejects an unsafe, unnormalized candidate - not merely trusting the caller", () => {
    // A malicious collectionSegment containing a leading slash would make
    // a naive template assembly produce "//evil.example/x", which the
    // WHATWG URL parser resolves as a protocol-relative URL to a different
    // host. generateRoute must reject this itself, before any consumer
    // ever sees the string.
    expect(() =>
      generateRoute({
        contentType: "Service",
        locale: "en",
        collectionSegment: "/evil.example",
        slug: "x",
      }),
    ).toThrow(ContentModelError);
  });

  test("CAP-1 generateRoute is idempotent-safe against an already-normalized candidate (no observable behavior change)", () => {
    expect(
      generateRoute({ contentType: "Service", locale: "en", collectionSegment: SEGMENTS.en, slug: "waste-audit" }),
    ).toBe("/en/services/waste-audit");
  });
});

test.describe("Story 0.4 unsafe-Unicode rejection (AC-0.4-03)", () => {
  test("CAP-1 rejects a C0 control character", () => {
    expect(() => normalizeRouteSegment("en", "slug", "waste\u0007audit")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects the DEL character", () => {
    expect(() => normalizeRouteSegment("en", "slug", "waste\u007Faudit")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects a C1 control character (NEL, U+0085)", () => {
    expect(() => normalizeRouteSegment("en", "slug", "waste\u0085audit")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects the Unicode line separator (U+2028) and paragraph separator (U+2029)", () => {
    expect(() => normalizeRouteSegment("en", "slug", "waste\u2028audit")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", "waste\u2029audit")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects the Arabic tatweel character", () => {
    expect(() => normalizeRouteSegment("en", "slug", "\u0640الخدمات")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects a bidi override control character", () => {
    expect(() => normalizeRouteSegment("en", "slug", "abc\u202Edef")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects the Arabic Letter Mark (U+061C)", () => {
    expect(() => normalizeRouteSegment("en", "slug", "abc\u061Cdef")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects zero-width invisible characters (ZWSP, ZWJ, word joiner, BOM, soft hyphen)", () => {
    expect(() => normalizeRouteSegment("en", "slug", "wa\u200Bste")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", "wa\u200Dste")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", "wa\u2060ste")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", "wa\uFEFFste")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", "wa\u00ADste")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects a variation selector (U+FE0F)", () => {
    expect(() => normalizeRouteSegment("en", "slug", "waste\uFE0F")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects a raw path separator", () => {
    expect(() => normalizeRouteSegment("tr", "slug", "atik/denetimi")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("tr", "slug", "atik?denetimi")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("tr", "slug", "atik#denetimi")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects a raw backslash", () => {
    expect(() => normalizeRouteSegment("tr", "slug", "atik\\denetimi")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects HTML-significant characters", () => {
    expect(() => normalizeRouteSegment("en", "slug", "<script>")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", "a&b")).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", `a"b`)).toThrow(ContentModelError);
    expect(() => normalizeRouteSegment("en", "slug", "a'b")).toThrow(ContentModelError);
  });

  test("CAP-1 rejects a double-percent-encoded slug", () => {
    // "%20" percent-encoded again is "%2520" - decoding once yields "%20"
    // (still containing a percent-triplet), decoding twice yields " ".
    expect(() => normalizeRouteSegment("en", "slug", "waste%2520audit")).toThrow(ContentModelError);
  });

  test("CAP-1 accepts a single, well-formed percent-encoding (decodes once to plain text)", () => {
    expect(normalizeRouteSegment("en", "slug", "waste%20audit")).toBe("waste audit");
  });

  test("CAP-1 each rejection message names the locale and the violated rule", () => {
    let caught: unknown;
    try {
      normalizeRouteSegment("en", "collectionSegment", "\u0640");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);
    if (!(caught instanceof ContentModelError)) throw new Error("unreachable");
    expect(caught.message).toContain("en");
    expect(caught.message).toContain("tatweel");
  });
});

test.describe("Story 0.4 fallback resolution (AC-0.4-02)", () => {
  const trOnly: readonly PublishedRoute[] = [
    { entityId: ENTITY_A, contentType: "Service", locale: "tr", collectionSegment: SEGMENTS.tr, slug: "atik-denetimi" },
  ];

  test("CAP-3 returns the native route when the requested locale has one", () => {
    const routes: readonly PublishedRoute[] = [
      ...trOnly,
      { entityId: ENTITY_A, contentType: "Service", locale: "en", collectionSegment: SEGMENTS.en, slug: "waste-audit" },
    ];
    expect(resolvePublicRoute(ENTITY_A, "en", routes)).toEqual({ kind: "native", url: "/en/services/waste-audit" });
  });

  test("CAP-3 falls back to the Turkish route with canonical+noindex when the requested locale has none", () => {
    expect(resolvePublicRoute(ENTITY_A, "en", trOnly)).toEqual({
      kind: "fallback",
      url: "/servisler/atik-denetimi",
      canonical: "/servisler/atik-denetimi",
      noindex: true,
    });
  });

  test("CAP-3 returns notFound when not even a Turkish route exists", () => {
    expect(resolvePublicRoute(ENTITY_A, "en", [])).toEqual({ kind: "notFound" });
  });

  test("CAP-3 never invents a target - the fallback URL is always generateRoute() over the Turkish candidate, never a string substitution of the requested locale", () => {
    const result = resolvePublicRoute(ENTITY_A, "en", trOnly);
    expect(result.kind).toBe("fallback");
    // A blind substitution would have produced a Turkish segment under `/en`.
    if (result.kind === "fallback") {
      expect(result.url).not.toContain("/en/");
      expect(result.url).toBe("/servisler/atik-denetimi");
    }
  });

  test("CAP-3 defensively ignores a route belonging to a different entityId, even in an unfiltered array - never trusting the caller's query scoping alone", () => {
    // entityB's Turkish route is present in the array (as if the caller
    // forgot to scope its query), but resolvePublicRoute is asked to
    // resolve entityA. It must never surface entityB's route.
    const unscoped: readonly PublishedRoute[] = [
      { entityId: ENTITY_B, contentType: "Service", locale: "tr", collectionSegment: SEGMENTS.tr, slug: "baska-hizmet" },
    ];
    expect(resolvePublicRoute(ENTITY_A, "en", unscoped)).toEqual({ kind: "notFound" });
  });
});
