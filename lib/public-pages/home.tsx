import type { Metadata } from "next";
import HomeComposed from "@/components/HomeComposed";
import { getPublicDictionary } from "@/lib/content";
import { loadPublicHomeView } from "@/lib/content-model/home-public-view";
import { listHomeCollectionCards } from "@/lib/public-content/home-collection-source";
import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { staticAlternates } from "@/lib/i18n/static-pages";

export async function generateHomeMetadata(locale: Locale): Promise<Metadata> {
  const meta = (await getPublicDictionary(locale)).meta.home;
  return {
    title: meta.title,
    description: meta.description,
    alternates: staticAlternates(locale, "home"),
  };
}

export async function HomePage({ locale }: { locale: Locale }) {
  const [dict, homeView, services, projects, team, posts] = await Promise.all([
    getPublicDictionary(locale),
    loadPublicHomeView(prisma, locale),
    listHomeCollectionCards("services", locale).catch(() => []),
    listHomeCollectionCards("projects", locale).catch(() => []),
    listHomeCollectionCards("team", locale).catch(() => []),
    listHomeCollectionCards("posts", locale).catch(() => []),
  ]);

  return (
    <HomeComposed
      locale={locale}
      dict={dict}
      composition={homeView.composition}
      collections={{ services, projects, team, posts }}
      mediaAssetsById={homeView.mediaAssetsById}
    />
  );
}
