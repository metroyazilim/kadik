import type { Metadata } from "next";
// Global 404 bu ağacın en üstünde, Next'in kendi varsayılan kök belgesiyle
// (`<html>`/`<body>`) render edilir - depoda kök `app/layout.tsx` yok, her
// segment kendi belgesini kurar. Bu yüzden burada `KadikLayout` sarmalanamaz
// (ikinci bir `<html>` hydration uyuşmazlığı üretir); stil dosyası doğrudan
// import edilir. Locale her zaman "en": apex 404, hangi dil segmentinin
// altında tetiklendiğini bilemez (route eşleşmesinden önce çalışır).
import "@/app/globals.css";
import { KadikNotFound } from "@/components/KadikSite";
import { getKadikSiteContent, kadikMetadata } from "@/lib/kadik-content/store";

export async function generateMetadata(): Promise<Metadata> {
  return { ...(await kadikMetadata("notFound")), robots: { index: false, follow: true } };
}

export default async function NotFound() {
  const { dict } = await getKadikSiteContent();
  return <KadikNotFound locale="en" dict={dict} />;
}
