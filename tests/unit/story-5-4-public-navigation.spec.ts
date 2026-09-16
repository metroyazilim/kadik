import { expect, test } from "@playwright/test";
import {
  resolveLocaleSwitchTarget,
  composeNavigation,
  navigationDependencyTags,
  type NavEntryConfig,
  type LocaleSwitchTarget,
} from "../../lib/content-model/public-navigation";
import { resolvePublicRoute, type PublishedRoute } from "../../lib/content-model/route-registry";
import { navigationConfigTag, contentEntityTag, contentAvailabilityTag } from "../../lib/content-model/cache-tags";

const ENGLISH_ROUTE: PublishedRoute = {
  entityId: "ent-1",
  contentType: "service",
  locale: "en",
  collectionSegment: "services",
  slug: "waste-audit",
};
const TURKISH_ROUTE: PublishedRoute = {
  entityId: "ent-1",
  contentType: "service",
  locale: "tr",
  collectionSegment: "servisler",
  slug: "atik-denetimi",
};

test.describe("AC-5.4-01 - locale-switch target never invents an address", () => {
  test("CAP-1 a native translation in the target locale returns native", () => {
    const result = resolveLocaleSwitchTarget("ent-1", "en", [ENGLISH_ROUTE, TURKISH_ROUTE], null, null);
    expect(result).toEqual({ kind: "native", url: "/en/services/waste-audit" });
  });

  test("CAP-1 a Turkish-only entity switching to Global uses the known Global collection alias", () => {
    const result = resolveLocaleSwitchTarget("ent-1", "en", [TURKISH_ROUTE], "services", null);
    expect(result).toEqual({
      kind: "fallbackAlias",
      url: "/en/services/atik-denetimi",
      canonical: "/servisler/atik-denetimi",
      noindex: true,
    });
  });

  test("CAP-1 without a known target-locale collection segment, degrades safely to the Turkish canonical URL rather than inventing one", () => {
    const result = resolveLocaleSwitchTarget("ent-1", "en", [TURKISH_ROUTE], null, null);
    expect(result).toEqual({
      kind: "fallbackAlias",
      url: "/servisler/atik-denetimi",
      canonical: "/servisler/atik-denetimi",
      noindex: true,
    });
  });

  test("CAP-1 neither native nor Turkish exists, but a collection fallback URL is supplied, returns collectionFallback", () => {
    const result = resolveLocaleSwitchTarget("ent-orphan", "en", [], null, "/en/services");
    expect(result).toEqual({ kind: "collectionFallback", url: "/en/services" });
  });

  test("CAP-1 no route, no collection fallback, returns disabled - never a fourth, invented outcome", () => {
    const result = resolveLocaleSwitchTarget("ent-orphan", "en", [], null, null);
    expect(result).toEqual({ kind: "disabled" });
  });
});

test.describe("AC-5.4-05 - locale-switch reuses, never re-derives, native/notFound classification", () => {
  test("CAP-1 resolveLocaleSwitchTarget's native outcome is identical to calling resolvePublicRoute directly", () => {
    const direct = resolvePublicRoute("ent-1", "en", [ENGLISH_ROUTE, TURKISH_ROUTE]);
    const viaSwitch = resolveLocaleSwitchTarget("ent-1", "en", [ENGLISH_ROUTE, TURKISH_ROUTE], null, null);
    expect(direct.kind).toBe("native");
    if (direct.kind === "native") expect(viaSwitch).toEqual({ kind: "native", url: direct.url });
  });

  test("CAP-1 a notFound resolvePublicRoute outcome falls through to disabled/collectionFallback, never a guessed native/fallback", () => {
    const direct = resolvePublicRoute("ent-orphan", "en", []);
    expect(direct.kind).toBe("notFound");
    expect(resolveLocaleSwitchTarget("ent-orphan", "en", [], null, null)).toEqual({ kind: "disabled" });
  });
});

test.describe("AC-5.4-02/03 - navigation includes only renderable targets, drops dangling fragments", () => {
  test("CAP-2 an entity target missing from resolvedTargets, or resolved to collectionFallback/disabled, is dropped - never shown disabled with a dead href", () => {
    const config: NavEntryConfig[] = [
      { id: "renderable", labelKey: "nav.services", target: { kind: "entity", entityId: "ent-1" } },
      { id: "unresolved", labelKey: "nav.missing", target: { kind: "entity", entityId: "ent-2" } },
      { id: "disabled", labelKey: "nav.disabled", target: { kind: "entity", entityId: "ent-3" } },
    ];
    const resolvedTargets = new Map<string, LocaleSwitchTarget>([
      ["renderable", { kind: "native", url: "/en/services/x" }],
      ["disabled", { kind: "disabled" }],
    ]);
    expect(composeNavigation(config, resolvedTargets, new Set())).toEqual([
      { id: "renderable", labelKey: "nav.services", url: "/en/services/x" },
    ]);
  });

  test("CAP-2 a fallbackAlias entity target is included with its own alias URL, never the Turkish canonical", () => {
    const config: NavEntryConfig[] = [
      { id: "svc", labelKey: "nav.services", target: { kind: "entity", entityId: "ent-1" } },
    ];
    const resolvedTargets = new Map<string, LocaleSwitchTarget>([
      [
        "svc",
        {
          kind: "fallbackAlias",
          url: "/ru/услуги/atik-denetimi",
          canonical: "/servisler/atik-denetimi",
          noindex: true,
        },
      ],
    ]);
    expect(composeNavigation(config, resolvedTargets, new Set())).toEqual([
      { id: "svc", labelKey: "nav.services", url: "/ru/услуги/atik-denetimi" },
    ]);
  });

  test("AC-5.4-03 a fragment anchor whose section does not render for this locale is dropped, never rendered pointing at nothing", () => {
    const config: NavEntryConfig[] = [
      { id: "visible-anchor", labelKey: "nav.hero", target: { kind: "fragment", sectionId: "hero" } },
      { id: "dangling-anchor", labelKey: "nav.team", target: { kind: "fragment", sectionId: "team" } },
    ];
    expect(composeNavigation(config, new Map(), new Set(["hero"]))).toEqual([
      { id: "visible-anchor", labelKey: "nav.hero", url: "#hero" },
    ]);
  });

  test("CAP-2 output preserves config's own order, filtered - never reordered", () => {
    const config: NavEntryConfig[] = [
      { id: "a", labelKey: "a", target: { kind: "fragment", sectionId: "a" } },
      { id: "b", labelKey: "b", target: { kind: "fragment", sectionId: "b" } },
      { id: "c", labelKey: "c", target: { kind: "fragment", sectionId: "c" } },
    ];
    const result = composeNavigation(config, new Map(), new Set(["c", "a"]));
    expect(result.map((entry) => entry.id)).toEqual(["a", "c"]);
  });
});

test.describe("AC-5.4-04 - cache-tag consistency across surfaces", () => {
  test("CAP-3 navigationDependencyTags produces tags drawn from resolve()'s own shared tag vocabulary, only for rendered entries", () => {
    const rendered = [{ id: "nav-1", labelKey: "nav.services", url: "/en/services/x" }];
    const entityIdByNavEntryId = new Map([["nav-1", "ent-1"]]);
    const navTags = navigationDependencyTags(rendered, entityIdByNavEntryId, "en");

    expect(navTags).toContain(navigationConfigTag());
    expect(navTags).toContain(contentEntityTag("ent-1"));
    expect(navTags).toContain(contentAvailabilityTag("ent-1", "en"));
    for (const tag of navTags.filter((t) => t !== navigationConfigTag())) {
      expect(tag.startsWith("content:")).toBe(true);
    }
  });

  test("CAP-3 an entity dropped by composeNavigation (never rendered) contributes no cache tag", () => {
    const rendered: { id: string; labelKey: string; url: string }[] = [];
    const entityIdByNavEntryId = new Map([["nav-dropped", "ent-dropped"]]);
    const navTags = navigationDependencyTags(rendered, entityIdByNavEntryId, "en");
    expect(navTags).toEqual([navigationConfigTag()]);
  });
});
