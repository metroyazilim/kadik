import type { Metadata } from "next";
import { KadikMembership } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("membership");
}

export default async function Page() {
  const { dict } = await getKadikSiteContent();
  return <KadikMembership locale="en" dict={dict} />;
}
