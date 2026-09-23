import type { Metadata } from "next";
import { KadikBoard } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { listPublishedTeamMembers } from "@/lib/public-content/team";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("board");
}

export default async function BoardPage() {
  const [{ dict }, members] = await Promise.all([getKadikSiteContent(), listPublishedTeamMembers("en").catch(() => [])]);
  return <KadikBoard locale="en" dict={dict} members={members} />;
}
