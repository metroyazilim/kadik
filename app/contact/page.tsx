import type { Metadata } from "next";
import { KadikContact } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("contact");
}

export default async function Page() {
  const { dict } = await getKadikSiteContent();
  return <KadikContact locale="en" dict={dict} />;
}
