import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { KadikPersonProfile } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { getKadikSiteContent } from "@/lib/kadik-content/store";
import { listPublishedTeamMembers } from "@/lib/public-content/team";
import { SITE_URL } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
const path = "/board/bob-farmer";
const description = "Bob Farmer’s published board role at KADİK London, with links to his personal biography, 1TVTR journalism and World Press Federation UK profile.";
const loadMember = cache(async () => {
  const members = await listPublishedTeamMembers("en");
  const member = members.find(item => item.name.trim().toLowerCase() === "bob farmer");
  if (!member) notFound();
  return member;
});
export async function generateMetadata(): Promise<Metadata> {
  const member = await loadMember();
  return { title: { absolute: "Bob Farmer — Board Profile | KADİK London" }, description, alternates: { canonical: `${SITE_URL}${path}` }, openGraph: { type: "profile", title: "Bob Farmer | KADİK London", description, url: `${SITE_URL}${path}`, images: [{ url: member.image.url, alt: member.name }] }, twitter: { card: "summary_large_image", title: "Bob Farmer | KADİK London", description, images: [member.image.url] } };
}
export default async function BobFarmerPage() {
  const [member, { dict }] = await Promise.all([loadMember(), getKadikSiteContent()]);
  const url = `${SITE_URL}${path}`;
  const person = { "@type": "Person", "@id": `${url}#person`, name: member.name, jobTitle: member.role, image: member.image.url, url, description, memberOf: { "@type": "Organization", name: dict.organization.name, url: `${SITE_URL}/` }, sameAs: ["https://www.bobfarmer.org/", "https://www.1tvtr.com/yazar/bob-farmer", "https://www.wpfuk.org/about/bob-farmer"] };
  return <><KadikJsonLd data={{ "@context": "https://schema.org", "@type": "ProfilePage", "@id": `${url}#profile`, url, mainEntity: person }} /><KadikPersonProfile locale="en" dict={dict} member={member} /></>;
}
