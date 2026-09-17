import type { Metadata } from "next";
import { KadikMembership } from "@/components/KadikSite";

export const metadata: Metadata = {
  title: "Membership Application | KADİK",
  description: "Kybele Atasever World Business Council membership application: share your company and sector details, and join a sector board after secretariat review.",
};

export default function MembershipPage() { return <KadikMembership locale="en" />; }
