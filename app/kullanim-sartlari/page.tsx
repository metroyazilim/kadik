import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Kullanım Koşulları | KADIK" };
export default function TurkishTermsPage() { return <KadikLegal terms />; }
