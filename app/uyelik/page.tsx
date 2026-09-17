import type { Metadata } from "next";
import { KadikMembership } from "@/components/KadikSite";

export const metadata: Metadata = {
  title: "Üyelik Başvurusu | KADİK",
  description: "Kybele Atasever Dünya İş Konseyi üyelik başvurusu: şirket ve sektör bilgilerinizi paylaşın, sekreterya değerlendirmesinin ardından sektör kurullarına katılın.",
};

export default function MembershipPage() { return <KadikMembership />; }
