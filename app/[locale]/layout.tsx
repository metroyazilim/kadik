import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Rajdhani } from "next/font/google";
import { notFound } from "next/navigation";
import { isLocale, LOCALE_DIRS, LOCALES, SITE_URL, type Locale } from "@/lib/i18n/config";
import "../globals.css";

// This is the root layout: `app/` holds nothing but the `[locale]` segment, so
// the locale layout is where `<html>` is emitted and where `lang` / `dir` can
// actually depend on the request.

// Brand pair, used for Turkish and English. `latin-ext` is required, not
// optional: the `latin` subset has no U+015F/U+011F, so without it Turkish
// s-cedilla and g-breve fall back to the system font mid-word.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jakarta",
});

const rajdhani = Rajdhani({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
});


// Turkish and Global English share the brand font pair.
const FONT_CLASSES: Record<Locale, string> = {
  tr: `${jakarta.variable} ${rajdhani.variable}`,
  en: `${jakarta.variable} ${rajdhani.variable}`,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

/** Only Turkish and Global English exist; any other locale is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // The font variable classes belong on <html>, not <body>: app/globals.css
  // resolves --font-sans / --font-display inside @theme, which lands in :root.
  // With the classes on <body> those vars are undefined at :root, the token
  // becomes guaranteed-invalid and every element falls back to the system font
  // - measured: <h1> rendered in -apple-system instead of Rajdhani.
  return (
    <html lang={locale} dir={LOCALE_DIRS[locale]} className={FONT_CLASSES[locale]}>
      <body className="bg-base font-sans text-[16px] leading-[26px] text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
