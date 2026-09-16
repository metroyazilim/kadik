import { expect, test } from "@playwright/test";
import { ContentModelError } from "../../lib/content-model/errors";
import { validatePayload } from "../../lib/content-model/payload-validation";
import { composePublicFooter, composePublicNavigation } from "../../lib/content-model/site-settings-nav";
import {
  SITE_SETTINGS_CONTENT_TYPE,
  SITE_SETTINGS_SCHEMA_VERSION,
  type SiteSettingsPayload,
} from "../../lib/content-model/site-settings-schema";

function expectInvalid(payload: unknown) {
  let caught: unknown;
  try {
    validatePayload(SITE_SETTINGS_CONTENT_TYPE, SITE_SETTINGS_SCHEMA_VERSION, payload);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ContentModelError);
  expect((caught as ContentModelError).classification).toBe("invalidInput");
}

function basePayload(): SiteSettingsPayload {
  return {
    brand: { name: "Metro", logoAssetId: null },
    contact: { email: null, phone: null, address: null },
    cta: { label: null, url: null },
    navigation: [],
    footer: { summary: "Footer summary.", columns: [] },
    mission: "Mission.",
    vision: "Vision.",
    termsBody: "",
    privacyBody: "",
  };
}

test.describe("AC-6.1-10 - site-settings payload validation edge cases", () => {
  test("rejects a non-object payload", () => {
    expectInvalid("not-an-object");
    expectInvalid(null);
    expectInvalid([]);
  });

  test("rejects a mismatched schema version", () => {
    let caught: unknown;
    try {
      validatePayload(SITE_SETTINGS_CONTENT_TYPE, 99, basePayload());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);
  });

  test("rejects a navigation item exceeding the max children count", () => {
    expectInvalid({
      ...basePayload(),
      navigation: [
        {
          id: "n1",
          label: "Too many",
          target: { kind: "external", url: "/" },
          children: Array.from({ length: 9 }, (_, index) => ({
            id: `c${index}`,
            label: `Child ${index}`,
            target: { kind: "external", url: "/" },
          })),
        },
      ],
    });
  });

  test("rejects a footer column with an unknown target kind", () => {
    expectInvalid({
      ...basePayload(),
      footer: {
        summary: "Footer",
        columns: [
          {
            id: "col1",
            title: "Column",
            links: [{ id: "l1", label: "Link", target: { kind: "javascript-injection" } }],
          },
        ],
      },
    });
  });

  test("rejects a missing required brand name", () => {
    expectInvalid({ ...basePayload(), brand: { name: "", logoAssetId: null } });
  });
});

test.describe("AC-6.1-04 - public navigation composition filters unresolved entries", () => {
  test("keeps a resolved external navigation item", async () => {
    const result = await composePublicNavigation(
      {} as Parameters<typeof composePublicNavigation>[0],
      "tr",
      [{ id: "n1", label: "Hakkımızda", target: { kind: "external", url: "/about" }, children: [] }],
    );
    expect(result).toEqual([{ id: "n1", label: "Hakkımızda", url: "/about", children: [] }]);
  });

  test("drops a parent with no children when its own target is a broken collection reference", async () => {
    const result = await composePublicNavigation(
      {
        contentEntity: { findUnique: async () => null },
      } as unknown as Parameters<typeof composePublicNavigation>[0],
      "tr",
      [
        {
          id: "n1",
          label: "Broken",
          target: { kind: "collection", contentType: "service", entityId: "missing" },
          children: [],
        },
      ],
    );
    expect(result).toEqual([]);
  });

  test("keeps a parent whose own target is broken but at least one child resolves", async () => {
    const result = await composePublicNavigation(
      {
        contentEntity: { findUnique: async () => null },
      } as unknown as Parameters<typeof composePublicNavigation>[0],
      "tr",
      [
        {
          id: "n1",
          label: "Hizmetler",
          target: { kind: "collection", contentType: "service", entityId: "missing" },
          children: [{ id: "c1", label: "Atık Denetimi", target: { kind: "external", url: "/servisler/atik-denetimi" } }],
        },
      ],
    );
    expect(result).toEqual([
      {
        id: "n1",
        label: "Hizmetler",
        url: "/servisler/atik-denetimi",
        children: [{ id: "c1", label: "Atık Denetimi", url: "/servisler/atik-denetimi" }],
      },
    ]);
  });

  test("drops a footer column whose every link is unresolved", async () => {
    const result = await composePublicFooter(
      {
        contentEntity: { findUnique: async () => null },
      } as unknown as Parameters<typeof composePublicFooter>[0],
      "tr",
      [
        {
          id: "col1",
          title: "Broken column",
          links: [{ id: "l1", label: "Broken", target: { kind: "collection", contentType: "service", entityId: "missing" } }],
        },
      ],
    );
    expect(result).toEqual([]);
  });
});
