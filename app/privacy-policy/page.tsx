import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("privacy");
}

export default async function Page() {
  const { dict } = await getKadikSiteContent();
  return <KadikLegal locale="en" dict={dict} />;
}
