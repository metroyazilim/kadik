import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Privacy Policy | KADİK" };
export default function PrivacyPage() { return <KadikLegal locale="en" />; }
