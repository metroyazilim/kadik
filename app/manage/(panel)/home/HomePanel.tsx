import type { ContentLocale } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPublicDictionary } from "@/lib/content";
import { loadFixedHomeAdminView } from "@/lib/content-model/home-fixed-admin";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import type { Dictionary } from "@/lib/i18n/types";
import { HomeAccordionList } from "./HomeAccordionList";

const LOCALES = ["tr", "en"] as const satisfies readonly ContentLocale[];

export async function HomePanel() {
  const dictionaries = Object.fromEntries(
    await Promise.all(
      LOCALES.map(async (locale) => [locale, await getPublicDictionary(locale)] as const),
    ),
  ) as Record<ContentLocale, Dictionary>;
  const [view, seoDefaults] = await Promise.all([
    loadFixedHomeAdminView(prisma, dictionaries),
    getSiteSeoDefaults(prisma, "tr"),
  ]);

  return (
    <HomeAccordionList
      initialSections={view.sections}
      mediaAssetsById={view.mediaAssetsById}
      brandName={seoDefaults.siteName}
    />
  );
}
