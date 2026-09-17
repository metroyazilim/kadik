import type { Metadata } from "next";
import { KadikContact } from "@/components/KadikSite";
export const metadata: Metadata = { title: "Contact | KADİK" };
export default function ContactPage() { return <KadikContact locale="en" />; }
