import LocaleLayout, { metadata } from "../[locale]/layout";

export { metadata };

/** Reuses the canonical Turkish document language, direction, and font root. */
export default function TurkishHomeLayout({ children }: { children: React.ReactNode }) {
  return <LocaleLayout params={Promise.resolve({ locale: "tr" })}>{children}</LocaleLayout>;
}
