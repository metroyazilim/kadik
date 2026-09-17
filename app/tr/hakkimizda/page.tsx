import type { Metadata } from "next";
import { KadikAbout } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Hakkımızda | KADİK" };
export default function TurkishAboutPage() { return <KadikAbout locale="tr" />; }
