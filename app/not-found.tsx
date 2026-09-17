import type { Metadata } from "next";
// Global 404 bu ağacın en üstünde, Next'in kendi varsayılan kök belgesiyle
// (`<html>`/`<body>`) render edilir - depoda kök `app/layout.tsx` yok, her
// segment kendi belgesini kurar. Bu yüzden burada `KadikLayout` sarmalanamaz
// (ikinci bir `<html>` hydration uyuşmazlığı üretir); stil dosyası doğrudan
// import edilir. Locale her zaman "en": apex 404, hangi dil segmentinin
// altında tetiklendiğini bilemez (route eşleşmesinden önce çalışır).
import "@/app/globals.css";
import { KadikNotFound } from "@/components/KadikSite";

export const metadata: Metadata = {
  title: "Page Not Found | KADİK",
  description: "The page you're looking for could not be found or may have moved. You can reach the council sections from here.",
  robots: { index: false, follow: true },
};

export default function NotFound() { return <KadikNotFound locale="en" />; }
