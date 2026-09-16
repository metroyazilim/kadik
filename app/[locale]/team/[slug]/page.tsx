import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublishedTeamMemberByRoute } from "@/lib/public-content/team";
import { isLocale, type Locale } from "@/lib/i18n/config";

function descriptionOf(bio: string) {
  const compact = bio.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157).trimEnd()}…` : compact;
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") return {};
  const locale = value as Locale;
  const member = await getPublishedTeamMemberByRoute(locale, slug);
  if (!member) return {};
  return { title: member.name, description: descriptionOf(member.bio) };
}

/**
 * Spec 6 cutover: TeamMember is `RETIRED`, so this old English-word
 * `/<locale>/team/<slug>` address (reachable for `ru`/`ar`; `en`'s own
 * literal `app/en/team/[slug]` folder already wins over this dynamic
 * route) has no legacy content of its own - it exists only to redirect to
 * the real native detail route, or 404 if the slug does not resolve to a
 * published entity at all. A `/tr/team/<slug>` request never reaches this
 * file (redirected by next.config.ts); the explicit `notFound()` below is
 * defense-in-depth (AC-2.12).
 */
export default async function TeamMemberDetailPage({ params }: { params: Params }) {
  const { locale: value, slug } = await params;
  if (!isLocale(value) || value === "tr") notFound();
  const locale = value as Locale;
  const member = await getPublishedTeamMemberByRoute(locale, slug);
  if (!member) notFound();
  redirect(member.canonicalUrl);
}
