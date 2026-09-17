import type { Metadata } from "next";
import { KadikNotFound } from "@/components/KadikSite";

/** Locale-scoped 404 for everything under `/tr/*` - rendered inside
 * `app/tr/layout.tsx` (which already provides `<html lang="tr">`), unlike
 * the root `app/not-found.tsx` which has no parent layout to render inside. */
export const metadata: Metadata = {
  title: "Sayfa Bulunamadı | KADİK",
  description: "Aradığınız sayfa bulunamadı veya taşınmış olabilir. Konsey bölümlerine buradan ulaşabilirsiniz.",
  robots: { index: false, follow: true },
};

export default function TurkishNotFound() { return <KadikNotFound locale="tr" />; }
