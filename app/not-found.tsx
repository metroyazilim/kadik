import type { Metadata } from "next";
// Global 404 bu ağacın en üstünde, Next'in kendi varsayılan kök belgesiyle
// (`<html>`/`<body>`) render edilir - depoda kök `app/layout.tsx` yok, her
// segment kendi belgesini kurar. Bu yüzden burada `KadikLayout` sarmalanamaz
// (ikinci bir `<html>` hydration uyuşmazlığı üretir); stil dosyası doğrudan
// import edilir.
import "@/app/globals.css";
import { KadikNotFound } from "@/components/KadikSite";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı | KADİK",
  description: "Aradığınız sayfa bulunamadı veya taşınmış olabilir. Konsey bölümlerine buradan ulaşabilirsiniz.",
  robots: { index: false, follow: true },
};

export default function NotFound() { return <KadikNotFound />; }
