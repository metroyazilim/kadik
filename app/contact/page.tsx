import type { Metadata } from "next";
import { KadikContact } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("contact");
}

export default async function Page() {
  const { dict, seo } = await getKadikSiteContent();
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("contact", dict, seo.contact)} />
      <KadikContact locale="en" dict={dict} />
    </>
  );
}
