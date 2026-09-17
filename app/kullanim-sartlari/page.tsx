import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Kullanım Koşulları | KADİK" };
export default function TurkishTermsPage() { return <KadikLegal terms />; }
