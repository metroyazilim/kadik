import { KadikBoard } from "@/components/KadikSite";
import { listPublishedTeamMembers } from "@/lib/public-content/team";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kurul Üyeleri | KADİK" };

export default async function BoardPage() {
  const members = await listPublishedTeamMembers("tr").catch(() => []);
  return <KadikBoard locale="tr" members={members} />;
}
