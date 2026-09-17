import type { Metadata } from "next";
import { KadikContact } from "@/components/KadikSite";
export const metadata: Metadata = { title: "İletişim | KADİK" };
export default function TurkishContactPage() { return <KadikContact locale="tr" />; }
