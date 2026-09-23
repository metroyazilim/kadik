import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("terms");
}

export default async function Page() {
  const { dict, seo } = await getKadikSiteContent();
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("terms", dict, seo.terms)} />
      <KadikLegal locale="en" dict={dict} terms />
    </>
  );
}
