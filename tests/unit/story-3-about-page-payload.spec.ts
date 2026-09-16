import { expect, test } from "@playwright/test";
import { ContentModelError } from "../../lib/content-model/errors";
import {
  ABOUT_PAGE_CONTENT_TYPE,
  ABOUT_PAGE_SCHEMA_VERSION,
  validateAboutPagePayload,
  type AboutPagePayload,
} from "../../lib/content-model/about-page-schema";
import { validatePayload } from "../../lib/content-model/payload-validation";

function expectInvalid(payload: unknown) {
  let caught: unknown;
  try {
    validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, payload);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ContentModelError);
  expect((caught as ContentModelError).classification).toBe("invalidInput");
}

const valid: AboutPagePayload = {
  banner: "Hakkımızda",
  subtitle: "Bizi Tanıyın",
  titleBefore: "Teknolojiyle",
  titleAccent: "Geleceği",
  titleAfter: "İnşa Ediyoruz",
  text: "<p>Metro Yazılım olarak <strong>15 yıldır</strong> teknoloji üretiyoruz.</p>",
  collageImageAssetId: null,
  collageAlt: "Ekip fotoğrafı",
  experienceValue: "15",
  experienceUnit: "Yıl",
  experienceLabel: "Sektör Deneyimi",
  features: [
    { title: "Uzman Ekip", text: "Alanında uzman mühendisler." },
    { title: "Kanıtlanmış Süreç", text: "Baştan sona şeffaf proje yönetimi." },
  ],
  offeringSubtitle: "Sunduklarımız",
  offeringTitle: "Teknoloji Trendleriyle Öncü Olun",
  offeringLabels: ["Website", "Android", "IOS", "Watch", "IOT"],
  marquee: ["Yenilik", "Güven", "Hız", "Kalite"],
  teamSubtitle: "Ekibimiz",
  teamTitle: "Bizimle Tanışın",
  authorName: "Kaan Aksoy",
  authorRole: "Kurucu Ortak",
  authorImageAssetId: null,
  seoTitle: null,
  seoDescription: null,
};

test.describe("Spec 3 - About page payload (closed shape, field parity with the deleted dictionary)", () => {
  test("accepts a full valid payload and returns a detached canonical value", () => {
    const result = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, valid);
    expect(result).toEqual(valid);
    expect(result).not.toBe(valid);
  });

  test("routes through validatePayload via the content-page:about content type", () => {
    const result = validatePayload(ABOUT_PAGE_CONTENT_TYPE, ABOUT_PAGE_SCHEMA_VERSION, valid);
    expect(result).toEqual(valid);
  });

  test("rejects a mismatched schema version", () => {
    let caught: unknown;
    try {
      validateAboutPagePayload(2, valid);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentModelError);
  });

  test("rejects an unknown key (closed shape)", () => {
    expectInvalid({ ...valid, projects: [{ category: "Teknoloji", title: "Yazılım" }] });
  });

  test("rejects a missing required field", () => {
    const { banner: _banner, ...rest } = valid;
    expectInvalid(rest);
  });

  test("sanitizes a script tag out of the rich-text 'text' field", () => {
    const result = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, {
      ...valid,
      text: '<p>Safe</p><script>alert(1)</script>',
    });
    expect(result.text).not.toContain("<script>");
    expect(result.text).toContain("Safe");
  });

  test("accepts a non-null collageImageAssetId", () => {
    const result = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, { ...valid, collageImageAssetId: "asset-1" });
    expect(result.collageImageAssetId).toBe("asset-1");
  });

  test("accepts a non-null authorImageAssetId", () => {
    const result = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, { ...valid, authorImageAssetId: "asset-2" });
    expect(result.authorImageAssetId).toBe("asset-2");
  });

  test("rejects an empty authorName", () => {
    expectInvalid({ ...valid, authorName: "" });
  });

  test.describe("features - exactly two, reorderable, not addable/removable", () => {
    test("rejects one feature", () => {
      expectInvalid({ ...valid, features: [valid.features[0]] });
    });

    test("rejects three features", () => {
      expectInvalid({ ...valid, features: [...valid.features, { title: "Extra", text: "Extra" }] });
    });

    test("rejects a feature missing its text field", () => {
      expectInvalid({ ...valid, features: [{ title: "Only title" }, valid.features[1]] });
    });

    test("preserves reordered feature order", () => {
      const reordered = [valid.features[1], valid.features[0]] as const;
      const result = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, { ...valid, features: reordered });
      expect(result.features[0].title).toBe(valid.features[1].title);
    });
  });

  test.describe("offeringLabels - exactly five, reorderable, not addable/removable", () => {
    test("rejects four labels", () => {
      expectInvalid({ ...valid, offeringLabels: valid.offeringLabels.slice(0, 4) });
    });

    test("rejects six labels", () => {
      expectInvalid({ ...valid, offeringLabels: [...valid.offeringLabels, "Extra"] });
    });

    test("rejects an empty label", () => {
      expectInvalid({ ...valid, offeringLabels: ["", ...valid.offeringLabels.slice(1)] });
    });
  });

  test.describe("marquee - one to eight words, freely addable/removable/reorderable", () => {
    test("rejects zero words", () => {
      expectInvalid({ ...valid, marquee: [] });
    });

    test("accepts exactly one word", () => {
      const result = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, { ...valid, marquee: ["Tek"] });
      expect(result.marquee).toEqual(["Tek"]);
    });

    test("accepts exactly eight words", () => {
      const eight = Array.from({ length: 8 }, (_, i) => `Kelime${i}`);
      const result = validateAboutPagePayload(ABOUT_PAGE_SCHEMA_VERSION, { ...valid, marquee: eight });
      expect(result.marquee).toEqual(eight);
    });

    test("rejects nine words", () => {
      const nine = Array.from({ length: 9 }, (_, i) => `Kelime${i}`);
      expectInvalid({ ...valid, marquee: nine });
    });
  });
});
