import { PageHeader } from "@/components/admin/PageHeader";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { SiteSettingsPanel } from "./SiteSettingsPanel";
import type { SiteSettingsSectionKey } from "./SiteSettingsEditor";

type SearchParams = Promise<{ locale?: string; section?: string }>;
const SITE_SETTINGS_SECTION_KEYS = new Set<SiteSettingsSectionKey>([
  "general",
  "navigation",
  "contact",
  "social",
  "mission-vision",
  "legal",
  "page-copy",
  "default-seo",
  "advanced",
]);

function isSiteSettingsSectionKey(value: unknown): value is SiteSettingsSectionKey {
  return typeof value === "string" && SITE_SETTINGS_SECTION_KEYS.has(value as SiteSettingsSectionKey);
}


export default async function SiteSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { locale, section } = await searchParams;
  const initialLocale: Locale = locale && isLocale(locale) ? locale : "tr";
  const initialSection: SiteSettingsSectionKey = isSiteSettingsSectionKey(section) ? section : "general";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Site Ayarları"
        title="Ayar Merkezi"
        description="Marka, navigasyon, iletişim, misyon/vizyon ve yasal içerikleri açıklamalı bölümler halinde yönetin."
      />
      <SiteSettingsPanel locale={initialLocale} section={initialSection} />
    </div>
  );
}
