import type { Metadata } from "next";
import { KadikIssues } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";

// Content is edited in the admin panel ("Sayfalar") and read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("announcements");
}

export default async function Page() {
  const { dict } = await getKadikSiteContent();
  return <KadikIssues locale="en" dict={dict} />;
}
