import { prisma } from "../lib/db";
import { tr } from "../lib/i18n/dictionaries/tr";
import { en } from "../lib/i18n/dictionaries/en";
import { HOME_SECTION_SCHEMA_VERSION } from "../lib/content-model/home-section-schemas";
import type { ContentLocale, HomeSectionKey, Prisma, PrismaClient } from "@prisma/client";

const DICTS: Record<ContentLocale, typeof tr> = { tr, en };
const LOCALES: ContentLocale[] = ["tr", "en"];

function buildSectionBlocks(key: HomeSectionKey, loc: ContentLocale): readonly Record<string, unknown>[] {
  const d = DICTS[loc];

  switch (key) {
    case "hero":
      return [
        {
          id: "hero-title",
          type: "banner",
          visible: true,
          title: `${d.hero.titleTop} ${d.hero.titleBottom}`,
          body: `<p><strong>${d.hero.eyebrow.toUpperCase()}</strong></p><p>${d.hero.text}</p>`,
          cta: { label: d.common.learnMore, href: "#about" },
          mediaAssetId: null,
        },
      ];

    case "about":
      return [
        {
          id: "about-intro",
          type: "text",
          visible: true,
          html: `<h3>${d.about.title}</h3><p>${d.about.text}</p><ul>${d.about.checklist.map((item) => `<li>${item}</li>`).join("")}</ul>`,
        },
        {
          id: "about-kpi",
          type: "kpi",
          visible: true,
          value: d.about.statValue,
          label: d.about.statLabel,
          supportingText: d.common.callUsNow,
        },
      ];

    case "brandTrust":
      return [
        {
          id: "brand-trust-heading",
          type: "text",
          visible: true,
          html: `<p class="text-center"><strong>${d.common.brandTrust}</strong></p>`,
        },
      ];

    case "services":
      return [
        {
          id: "services-heading",
          type: "text",
          visible: true,
          html: `<h2>${d.services.title}</h2><p>${d.services.subtitle}: ${d.services.cardText}</p>`,
        },
        ...d.services.items.map((item, idx) => ({
          id: `service-item-${idx + 1}`,
          type: "banner" as const,
          visible: true,
          title: item,
          body: `<p>${d.services.cardText}</p>`,
          cta: { label: d.common.readMore, href: `/${loc}/services` },
          mediaAssetId: null,
        })),
      ];

    case "process":
      return [
        {
          id: "process-heading",
          type: "text",
          visible: true,
          html: `<h2>${d.process.title}</h2><p>${d.process.stepText}</p>`,
        },
        ...d.process.items.map((step, idx) => ({
          id: `process-step-${idx + 1}`,
          type: "kpi" as const,
          visible: true,
          value: String(idx + 1),
          label: step,
          supportingText: d.process.stepText,
        })),
      ];

    case "achievements":
      return [
        {
          id: "achievements-heading",
          type: "text",
          visible: true,
          html: `<h2>${d.achievements.title}</h2>`,
        },
        ...d.achievements.items.map((item, idx) => ({
          id: `achievement-${idx + 1}`,
          type: "kpi" as const,
          visible: true,
          value: item.value,
          label: item.label,
          supportingText: "",
        })),
      ];

    case "projects":
      return [
        {
          id: "projects-heading",
          type: "text",
          visible: true,
          html: `<h2>${d.projects.title}</h2>`,
        },
        ...d.projects.items.map((item, idx) => ({
          id: `project-item-${idx + 1}`,
          type: "banner" as const,
          visible: true,
          title: item.title,
          body: `<p>${item.category}</p>`,
          cta: { label: d.common.readMore, href: `/${loc}/projects` },
          mediaAssetId: null,
        })),
      ];

    case "marquee":
      return [
        {
          id: "marquee-content",
          type: "text",
          visible: true,
          html: `<p>${d.marquee.join(" ✱ ")}</p>`,
        },
      ];

    case "team":
      return [
        {
          id: "team-heading",
          type: "text",
          visible: true,
          html: `<h2>${d.team.title}</h2>`,
        },
        ...d.team.members.map((member, idx) => ({
          id: `team-member-${idx + 1}`,
          type: "quote" as const,
          visible: true,
          quote: member.role,
          source: member.name,
          mediaAssetId: null,
        })),
      ];

    case "testimonials":
      return [
        {
          id: "testimonials-heading",
          type: "text",
          visible: true,
          html: `<h2>${d.testimonials.title}</h2>`,
        },
        ...d.testimonials.items.map((t, idx) => ({
          id: `testimonial-${idx + 1}`,
          type: "quote" as const,
          visible: true,
          quote: d.testimonials.quote,
          source: `${t.name} - ${t.role}`,
          mediaAssetId: null,
        })),
      ];

    case "blog":
      return [
        {
          id: "blog-heading",
          type: "text",
          visible: true,
          html: `<h2>${d.blog.title}</h2>`,
        },
        ...d.blog.posts.map((post, idx) => ({
          id: `blog-post-${idx + 1}`,
          type: "banner" as const,
          visible: true,
          title: post.title,
          body: `<p>${post.category} · ${d.common.editor}</p>`,
          cta: { label: d.common.readMore, href: `/${loc}/blog` },
          mediaAssetId: null,
        })),
      ];
  }
}

export async function seedHomeClientData(client: PrismaClient = prisma) {
  console.log("Seeding home section live client payloads...");
  const sections = await client.homeSection.findMany({
    include: { entity: { include: { translations: true } } },
  });

  for (const section of sections) {
    for (const locale of LOCALES) {
      const translation = section.entity.translations.find((t) => t.locale === locale);
      if (!translation) continue;
      if (translation.publishedRevisionId) continue;

      const blocks = buildSectionBlocks(section.key, locale);
      const payload = { blocks };

      // Create new published revision and update pointers so it's live both in admin and publicly
      const revision = await client.contentTranslationRevision.create({
        data: {
          translationId: translation.id,
          schemaVersion: HOME_SECTION_SCHEMA_VERSION,
          payload: payload as unknown as Prisma.InputJsonValue,
          createdBy: "system-seed",
        },
      });

      await client.contentTranslation.update({
        where: { id: translation.id },
        data: {
          draftRevisionId: revision.id,
          publishedRevisionId: revision.id,
          publishedAt: new Date(),
          version: { increment: 1 },
        },
      });
    }
  }

  console.log("Finished seeding live home section data!");
}
