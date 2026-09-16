import { expect, test } from "@playwright/test";
import { ContentModelError } from "../../lib/content-model/errors";
import {
  SERVICE_CONTENT_TYPE,
  SERVICE_SCHEMA_VERSION,
  PRODUCT_CONTENT_TYPE,
  PRODUCT_SCHEMA_VERSION,
  PROJECT_CONTENT_TYPE,
  PROJECT_SCHEMA_VERSION,
  TEAM_MEMBER_CONTENT_TYPE,
  TEAM_MEMBER_SCHEMA_VERSION,
  FAQ_CONTENT_TYPE,
  FAQ_SCHEMA_VERSION,
  POST_CONTENT_TYPE,
  POST_SCHEMA_VERSION,
  validatePayload,
  type ServicePayload,
  type ProductPayload,
  type ProjectPayload,
  type TeamMemberPayload,
  type FaqPayload,
  type PostPayload,
} from "../../lib/content-model/payload-validation";

function expectInvalid(contentType: string, schemaVersion: number, payload: unknown) {
  let caught: unknown;
  try {
    validatePayload(contentType, schemaVersion, payload);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ContentModelError);
  expect((caught as ContentModelError).classification).toBe("invalidInput");
}

test.describe("Story 3.1 - Service payload (MediaAsset relation, not a raw URL)", () => {
  const valid: ServicePayload = {
    title: "Endüstriyel Atık Denetimi",
    slug: "atik-denetimi",
    summary: "Kısa özet metni.",
    blocks: [{ id: "b1", type: "text", html: "<p>Zengin <strong>gövde</strong> içeriği.</p>" }],
    icon: "recycle",
    imageAssetId: "clx0000000000000000000001",
    seoTitle: null,
    seoDescription: null,
  };

  test("accepts a full valid payload and returns a detached canonical value", () => {
    const actual = validatePayload(SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, valid) as ServicePayload;
    expect(actual).not.toBe(valid);
    expect(actual.imageAssetId).toBe(valid.imageAssetId);
    expect(actual.blocks[0]).toMatchObject({ type: "text" });
    expect((actual.blocks[0] as { html: string }).html).toContain("<strong>");
  });

  test("accepts a null imageAssetId (no image attached yet)", () => {
    const actual = validatePayload(SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, {
      ...valid,
      imageAssetId: null,
    }) as ServicePayload;
    expect(actual.imageAssetId).toBeNull();
  });

  test("rejects a numeric imageAssetId", () => {
    expectInvalid(SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, { ...valid, imageAssetId: 42 });
  });

  test("rejects an empty required field", () => {
    expectInvalid(SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, { ...valid, title: "" });
    expectInvalid(SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, { ...valid, blocks: [] });
  });

  test("rejects an unknown key (closed shape)", () => {
    expectInvalid(SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, { ...valid, image: "https://evil.example/x.jpg" });
  });

  test("strips a script tag out of a TEXT block but keeps plain summary untouched", () => {
    const actual = validatePayload(SERVICE_CONTENT_TYPE, SERVICE_SCHEMA_VERSION, {
      ...valid,
      blocks: [{ id: "b1", type: "text", html: '<p>safe</p><script>alert(1)</script>' }],
      summary: "<b>not sanitized, stored as-is since summary is plain text</b>",
    }) as ServicePayload;
    expect((actual.blocks[0] as { html: string }).html).not.toContain("<script>");
    expect(actual.summary).toContain("<b>");
  });
});

test.describe("Story 3.2 - Product/Project payloads", () => {
  const product: ProductPayload = {
    title: "Bulut Güvenlik Paketi",
    slug: "bulut-guvenlik-paketi",
    summary: "Özet",
    blocks: [{ id: "b1", type: "text", html: "<p>Detay</p>" }],
    imageAssetId: null,
    galleryAssetIds: ["clx0000000000000000000002", "clx0000000000000000000003"],
    badge: "Yeni",
    priceLabel: "Talep üzerine",
    ctaUrl: "/iletisim",
    seoTitle: null,
    seoDescription: null,
  };

  test("accepts a valid product payload with a gallery", () => {
    const actual = validatePayload(PRODUCT_CONTENT_TYPE, PRODUCT_SCHEMA_VERSION, product) as ProductPayload;
    expect(actual.galleryAssetIds).toHaveLength(2);
  });

  test("rejects a javascript: CTA URL", () => {
    expectInvalid(PRODUCT_CONTENT_TYPE, PRODUCT_SCHEMA_VERSION, { ...product, ctaUrl: "javascript:alert(1)" });
  });

  test("rejects more than 24 gallery assets", () => {
    expectInvalid(PRODUCT_CONTENT_TYPE, PRODUCT_SCHEMA_VERSION, {
      ...product,
      galleryAssetIds: Array.from({ length: 25 }, (_, i) => `clx${i}`),
    });
  });

  const project: ProjectPayload = {
    title: "Veri Merkezi Modernizasyonu",
    slug: "veri-merkezi-modernizasyonu",
    category: "Altyapı",
    coverImageAssetId: null,
    galleryAssetIds: [],
    challengeBlocks: [{ id: "b1", type: "text", html: "<p>Zorluk</p>" }],
    solutionBlocks: [{ id: "b1", type: "text", html: "<p>Çözüm</p>" }],
    client: "Acme A.Ş.",
    seoTitle: null,
    seoDescription: null,
  };

  test("accepts a valid project payload with rich challenge/solution blocks", () => {
    const actual = validatePayload(PROJECT_CONTENT_TYPE, PROJECT_SCHEMA_VERSION, project) as ProjectPayload;
    expect((actual.challengeBlocks[0] as { html: string }).html).toContain("<p>");
    expect((actual.solutionBlocks[0] as { html: string }).html).toContain("<p>");
  });

  test("rejects a missing category", () => {
    expectInvalid(PROJECT_CONTENT_TYPE, PROJECT_SCHEMA_VERSION, { ...project, category: "" });
  });
});

test.describe("Story 3.3 - Team member / FAQ payloads", () => {
  const team: TeamMemberPayload = {
    name: "Ayşe Yılmaz",
    slug: "ayse-yilmaz",
    role: "Baş Mühendis",
    imageAssetId: null,
    email: "ayse@example.com",
    phone: null,
    social: { instagram: "https://instagram.com/ayse", linkedin: null },
    bio: "<p>Kısa biyografi.</p>",
    seoTitle: null,
    seoDescription: null,
  };

  test("accepts a valid team member payload", () => {
    const actual = validatePayload(TEAM_MEMBER_CONTENT_TYPE, TEAM_MEMBER_SCHEMA_VERSION, team) as TeamMemberPayload;
    expect(actual.social?.instagram).toBe("https://instagram.com/ayse");
  });

  test("rejects an unsupported social key", () => {
    expectInvalid(TEAM_MEMBER_CONTENT_TYPE, TEAM_MEMBER_SCHEMA_VERSION, {
      ...team,
      social: { facebook: "https://facebook.com/x" },
    });
  });

  const faq: FaqPayload = { question: "Hizmet süresi ne kadar?", answer: "<p>Ortalama iki hafta.</p>" };

  test("accepts a valid FAQ payload with no slug/SEO fields", () => {
    const actual = validatePayload(FAQ_CONTENT_TYPE, FAQ_SCHEMA_VERSION, faq) as FaqPayload;
    expect(actual.question).toBe(faq.question);
  });

  test("rejects an extra slug field on FAQ (closed shape, no route)", () => {
    expectInvalid(FAQ_CONTENT_TYPE, FAQ_SCHEMA_VERSION, { ...faq, slug: "should-not-exist" });
  });
});

test.describe("Story 3.4 - Blog post payload", () => {
  const post: PostPayload = {
    title: "Bulut Güvenliğinde 5 Adım",
    slug: "bulut-guvenliginde-5-adim",
    excerpt: "Kısa özet",
    blocks: [{ id: "b1", type: "text", html: "<p>Uzun gövde</p>" }],
    category: "Güvenlik",
    author: "Corporate Starter",
    coverImageAssetId: null,
    seoTitle: null,
    seoDescription: null,
  };

  test("accepts a valid post payload; publication date is not part of the payload", () => {
    const actual = validatePayload(POST_CONTENT_TYPE, POST_SCHEMA_VERSION, post) as PostPayload;
    expect(Object.keys(actual)).not.toContain("publishedAt");
    expect(Object.keys(actual)).not.toContain("publicationDate");
  });

  test("rejects a missing author", () => {
    expectInvalid(POST_CONTENT_TYPE, POST_SCHEMA_VERSION, { ...post, author: "" });
  });
});
