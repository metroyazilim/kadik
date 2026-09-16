import type { Metadata } from "next";
import { getPublicDictionary } from "@/lib/content";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı | KADIK",
  description: "Aradığınız sayfa bulunamadı veya taşınmış olabilir.",
};

export default async function NotFound() {
  let dict;
  try {
    dict = await getPublicDictionary("tr");
  } catch {
    dict = null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      {dict ? <SiteHeader locale="tr" dict={dict} /> : null}
      <main className="mx-auto flex flex-1 w-full max-w-7xl flex-col items-center justify-center px-[15px] py-24 text-center">
        <span className="font-display text-7xl font-bold text-brand">404</span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Sayfa bulunamadı</h1>
        <p className="mt-4 max-w-md text-base text-muted">
          Aradığınız sayfa kaldırılmış, adı değiştirilmiş veya geçici olarak erişilemiyor olabilir.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
          >
            Ana sayfaya dön
          </a>
          <a
            href="/iletisim"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:bg-base"
          >
            İletişime geç
          </a>
        </div>
      </main>
      {dict ? <Footer locale="tr" dict={dict} /> : null}
    </div>
  );
}
