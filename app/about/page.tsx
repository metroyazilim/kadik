import type { Metadata } from "next";
import { KadikAbout } from "@/components/KadikSite";
export const metadata: Metadata = { title: "About Us | KADİK" };
export default function AboutPage() { return <KadikAbout locale="en" />; }
