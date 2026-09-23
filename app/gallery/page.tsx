import type { Metadata } from "next";
import { KadikGallery } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { listPublicGallery } from "@/lib/kadik-content/collections";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("gallery");
}

export default async function Page() {
  const [{ dict, seo }, items] = await Promise.all([getKadikSiteContent(), listPublicGallery()]);
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("gallery", dict, seo.gallery, { gallery: items.map((item) => ({ image: item.image, caption: item.caption })) })} />
      <KadikGallery locale="en" dict={dict} items={items} />
    </>
  );
}
