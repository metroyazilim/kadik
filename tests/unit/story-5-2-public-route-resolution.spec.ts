import { expect, test } from "@playwright/test";
import {
  resolveRouteIdentity,
  resolveLegacyOrUnknownAddress,
} from "../../lib/content-model/public-route-resolution";
import type { PublishedRoute } from "../../lib/content-model/route-registry";

const CONTENT_TYPE = "service";

const NATIVE_EN: PublishedRoute = {
  entityId: "ent-1",
  contentType: CONTENT_TYPE,
  locale: "en",
  collectionSegment: "services",
  slug: "waste-audit",
};

const TURKISH_TR: PublishedRoute = {
  entityId: "ent-2",
  contentType: CONTENT_TYPE,
  locale: "tr",
  collectionSegment: "servisler",
  slug: "atik-denetimi",
};

/** `ent-1`'s own second published route in Turkish, under a *different*
 * slug than `NATIVE_EN` - used to prove a Turkish-slug alias request never
 * gets silently rewritten to that entity's unrelated native English URL. */
const NATIVE_EN_TR_ROUTE: PublishedRoute = {
  entityId: "ent-1",
  contentType: CONTENT_TYPE,
  locale: "tr",
  collectionSegment: "servisler",
  slug: "farkli-slug",
};

test.describe("AC-5.2-01 - native reverse resolution", () => {
  test("CAP-1 an exact (contentType, locale, collectionSegment, slug) match resolves to that row's own entity", () => {
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "waste-audit" },
      [NATIVE_EN],
      [],
    );
    expect(result).toEqual({ kind: "native", entityId: "ent-1", url: "/en/services/waste-audit" });
  });

  test("CAP-1 a native candidate belonging to a different entity/locale/segment than requested is never accepted blindly", () => {
    const wrongLocaleCandidate: PublishedRoute = { ...NATIVE_EN, locale: "tr" };
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "waste-audit" },
      [wrongLocaleCandidate],
      [],
    );
    expect(result).toEqual({ kind: "notFound" });
  });
});

test.describe("AC-5.2-02 - fallback-alias resolution", () => {
  test("CAP-2 the requested locale's own collection segment paired with the verified Turkish slug resolves to a fallbackAlias, never by string substitution", () => {
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "atik-denetimi" },
      [],
      [TURKISH_TR],
    );
    expect(result).toEqual({
      kind: "fallbackAlias",
      entityId: "ent-2",
      canonical: "/servisler/atik-denetimi",
      noindex: true,
    });
  });

  test("CAP-2 a Turkish-slug alias request never silently resolves to the entity's own unrelated native URL in the requested locale", () => {
    // ent-1 has a native EN route (NATIVE_EN, slug "waste-audit") AND its
    // own Turkish route under a *different* slug ("farkli-slug"). A request
    // for "/en/services/farkli-slug" (the Turkish slug, under English's own
    // segment) must never resolve to ent-1's real English URL
    // ("waste-audit") - that would let one entity serve identical content
    // at two different English addresses, breaking one-canonical-URL-per-
    // locale.
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "farkli-slug" },
      [NATIVE_EN],
      [NATIVE_EN_TR_ROUTE],
    );
    expect(result).toEqual({
      kind: "fallbackAlias",
      entityId: "ent-1",
      canonical: "/servisler/farkli-slug",
      noindex: true,
    });
  });

  test("CAP-2 a Turkish request never falls back to itself - Turkish is the source locale, there is no further fallback to check", () => {
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "tr", collectionSegment: "yanlis-segment", slug: "atik-denetimi" },
      [],
      [TURKISH_TR],
    );
    expect(result).toEqual({ kind: "notFound" });
  });

  test("CAP-2 a turkishCandidates row whose own locale is not actually tr is never trusted blindly", () => {
    const spoofedCandidate: PublishedRoute = { ...TURKISH_TR, locale: "en" };
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "atik-denetimi" },
      [],
      [spoofedCandidate],
    );
    expect(result).toEqual({ kind: "notFound" });
  });

  test("CAP-2 the wrong (non-Turkish) locale's own slug is never recognized as a fallback alias", () => {
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "waste-audit" },
      [],
      [TURKISH_TR],
    );
    expect(result).toEqual({ kind: "notFound" });
  });
});

test.describe("AC-5.2-03 - native precedence over fallback and over legacy", () => {
  test("CAP-1/CAP-2 a native match wins even when a Turkish slug match for the same content type is also present", () => {
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "waste-audit" },
      [NATIVE_EN],
      [TURKISH_TR],
    );
    expect(result.kind).toBe("native");
  });
});

test.describe("AC-5.2-04 - unsafe-input rejection", () => {
  test("CAP-1 a slug that fails normalizeRouteSegment is rejected as invalidInput before any candidate is inspected", () => {
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "services", slug: "abc\u202Edef" },
      [NATIVE_EN],
      [],
    );
    expect(result.kind).toBe("invalidInput");
  });

  test("CAP-1 an empty collection segment is rejected as invalidInput", () => {
    const result = resolveRouteIdentity(
      { contentType: CONTENT_TYPE, locale: "en", collectionSegment: "", slug: "waste-audit" },
      [],
      [],
    );
    expect(result.kind).toBe("invalidInput");
  });
});

test.describe("AC-5.2-05 - verified-only legacy redirect", () => {
  test("CAP-3 a mapping to a currently-resolvable entity returns a verified redirect computed via resolvePublicRoute", () => {
    const result = resolveLegacyOrUnknownAddress(
      { targetEntityId: "ent-2" },
      [TURKISH_TR],
      "tr",
      null,
    );
    expect(result).toEqual({ kind: "redirect", entityId: "ent-2", url: "/servisler/atik-denetimi" });
  });

  test("CAP-3 no mapping and no collection fallback returns notFound, never an invented target", () => {
    expect(resolveLegacyOrUnknownAddress(null, [], "en", null)).toEqual({ kind: "notFound" });
  });

  test("CAP-3 no mapping but a collection fallback URL returns the collection classification", () => {
    expect(resolveLegacyOrUnknownAddress(null, [], "en", "/en/services")).toEqual({
      kind: "collection",
      url: "/en/services",
    });
  });

  test("CAP-3 a mapping to an entity with no published route anywhere falls through to notFound/collection, never a guessed address", () => {
    const result = resolveLegacyOrUnknownAddress({ targetEntityId: "ent-orphan" }, [], "en", null);
    expect(result).toEqual({ kind: "notFound" });
  });
});
