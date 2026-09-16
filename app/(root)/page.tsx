import type { Metadata } from "next";
import { KadikHome } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Anasayfa | KADIK", description: "Kadık dayanışma ve değişim hareketi." };
export default function TurkishHomePage() { return <KadikHome />; }
