import { redirect } from "next/navigation";

/**
 * The starter template's settings centre never reached the KADİK site. Brand
 * name, menu, footer and social links are edited under Sayfalar → Header &
 * Footer; old bookmarks land there.
 */
export default function LegacySiteSettings() {
  redirect("/manage/pages/global");
}
