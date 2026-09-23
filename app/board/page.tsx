import type { Metadata } from "next";
import { KadikBoard } from "@/components/KadikSite";
import { KadikJsonLd } from "@/components/KadikJsonLd";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";
import { kadikPageGraph } from "@/lib/kadik-content/structured-data";
import { listPublishedTeamMembers } from "@/lib/public-content/team";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return kadikMetadata("board");
}

export default async function BoardPage() {
  const [{ dict, seo }, members] = await Promise.all([getKadikSiteContent(), listPublishedTeamMembers("en").catch(() => [])]);
  const people = members.map((member) => ({ name: member.name, role: member.role, image: member.image.url }));
  return (
    <>
      <KadikJsonLd data={kadikPageGraph("board", dict, seo.board, { members: people })} />
      <KadikBoard locale="en" dict={dict} members={members} />
    </>
  );
}
