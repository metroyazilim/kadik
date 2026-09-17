import { KadikBoard } from "@/components/KadikSite";
import { listPublishedTeamMembers } from "@/lib/public-content/team";

export const dynamic = "force-dynamic";
export const metadata = { title: "Board Members | KADİK" };

export default async function BoardPage() {
  const members = await listPublishedTeamMembers("en").catch(() => []);
  return <KadikBoard locale="en" members={members} />;
}
