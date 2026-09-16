import type { Locale } from "@/lib/i18n/config";
import { SiteSettingsEditor, type SiteSettingsSectionKey } from "./SiteSettingsEditor";

/** Brand, contact, CTA, navigation, footer, mission/vision, and legal-content settings share one singleton record. */
export function SiteSettingsPanel({ locale = "tr", section = "general" }: { locale?: Locale; section?: SiteSettingsSectionKey }) {
  return <SiteSettingsEditor initialLocale={locale} initialSection={section} />;
}
