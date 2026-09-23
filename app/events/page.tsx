import type { Metadata } from "next";
import { KadikEvents } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { listPublicEvents } from "@/lib/kadik-content/collections";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("events");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const [{ dict, seo }, events] = await Promise.all([getKadikSiteContent(), listPublicEvents()]);
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("events", dict, seo.events, { events })} />
      <KadikEvents locale="en" dict={dict} events={events} initialEventId={event} />
    </>
  );
}
