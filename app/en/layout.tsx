import LocaleLayout, { metadata } from "../[locale]/layout";

export { metadata };

/** Reuses the canonical English document language, direction, and font root. */
export default function EnglishServiceLayout({ children }: { children: React.ReactNode }) {
  return <LocaleLayout params={Promise.resolve({ locale: "en" })}>{children}</LocaleLayout>;
}
