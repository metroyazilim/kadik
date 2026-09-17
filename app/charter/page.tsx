import type { Metadata } from "next";
import { KadikLegal } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Charter | KADİK" };
export default function CharterPage() { return <KadikLegal locale="en" charter />; }
