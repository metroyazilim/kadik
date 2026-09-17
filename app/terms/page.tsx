import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Terms of Use | KADİK" };
export default function TermsPage() { return <KadikLegal locale="en" terms />; }
