import type { Metadata } from "next";
import { KadikIssues } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { listPublicAnnouncements } from "@/lib/kadik-content/collections";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("announcements");
}

export default async function Page() {
  const [{ dict, seo }, announcements] = await Promise.all([getKadikSiteContent(), listPublicAnnouncements()]);
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("announcements", dict, seo.announcements, {})} />
      <KadikIssues locale="en" dict={dict} announcements={announcements} />
    </>
  );
}
