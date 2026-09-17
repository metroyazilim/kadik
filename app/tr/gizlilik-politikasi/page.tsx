import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Gizlilik Politikası | KADİK" };
export default function TurkishPrivacyPage() { return <KadikLegal locale="tr" />; }
