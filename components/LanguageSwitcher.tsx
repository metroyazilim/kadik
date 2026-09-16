"use client";

// Two-option language picker: prefixless Turkish and Global English.
// The visible Global label is product language; the standards-facing locale
// remains `en` for URLs, `lang`, `hreflang`, and content storage.
//
// Click-driven, not hover: a hover-only menu never opens on touch, and driving
// open/close from the same element with both mouseenter and click makes a real
// tap open then immediately close the menu.
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { findStaticPageKeyBySegment, staticPath } from "@/lib/i18n/static-pages";

/**
 * CMS collection roots, duplicated as literals for this reverse lookup
 * only (never a write path) - the same stable per-locale values
 * `lib/content-model/*-routes.ts` owns, kept out of this client
 * component's bundle for the same reason `static-pages.ts`'s redirect
 * table duplicates them rather than importing content-model (see
 * spec-2.md §14.1 "next.config.ts import weight" - the same weight
 * concern applies to a client bundle).
 */
const COLLECTION_SEGMENTS: Readonly<Record<string, Readonly<Record<Locale, string>>>> = {
  services: { tr: "servisler", en: "services" },
  products: { tr: "urunler", en: "products" },
  projects: { tr: "projeler", en: "projects" },
  team: { tr: "ekip", en: "team" },
  blog: { tr: "blog", en: "blog" },
};

const LOCALE_CODES: Record<Locale, string> = { tr: "TR", en: "GL" };


interface LanguageSwitcherProps {
  locale: Locale;
  label: string;
  /** `light` sits on the dark top strip, `dark` inside the mobile drawer. */
  tone?: "light" | "dark";
}

export default function LanguageSwitcher({ locale, label, tone = "light" }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Turkish is prefixless; Global English lives under `/en`.
  const allSegments = pathname.split("/").filter(Boolean);
  const [firstSegment, ...restSegments] = locale === "tr" ? allSegments : allSegments.slice(1);
  const tail = restSegments.length > 0 ? `/${restSegments.join("/")}` : "";

  /**
   * Resolves the current page's counterpart in the target locale through the
   * static-page or collection registry instead of reusing divergent segments.
   */
  function hrefFor(candidate: Locale): string {
    if (!firstSegment) return candidate === "tr" ? "/" : `/${candidate}`;

    const staticKey = findStaticPageKeyBySegment(locale, firstSegment);
    if (staticKey) return staticPath(candidate, staticKey);

    const collection = Object.values(COLLECTION_SEGMENTS).find((segments) => segments[locale] === firstSegment);
    if (collection) {
      const target = collection[candidate];
      return candidate === "tr" ? `/${target}${tail}` : `/${candidate}/${target}${tail}`;
    }

    // Unrecognized segment: land on the target locale's home rather than
    // emitting a broken concatenated path.
    return candidate === "tr" ? "/" : `/${candidate}`;
  }

  const isLight = tone === "light";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 transition-colors ${
          isLight ? "text-white/80 hover:text-white" : "text-ink hover:text-brand"
        }`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold leading-none ${
            isLight ? "bg-white/15 text-white" : "bg-brand-soft text-brand"
          }`}
        >
          {LOCALE_CODES[locale]}
        </span>
        <span className={`text-[16px] font-medium ${isLight ? "text-white" : ""}`}>
          {LOCALE_NAMES[locale]}
        </span>
        <span aria-hidden className="text-[10px]">
          &#9662;
        </span>
      </button>

      {open ? (
        <ul
          // Anchored to the trigger's inline-end so it never leaves the viewport
          // in either writing direction.
          className="absolute end-0 top-full z-50 mt-2 w-[160px] overflow-hidden rounded-[8px] bg-base py-1 shadow-[var(--shadow-menu)]"
          role="listbox"
        >
          {LOCALES.map((candidate) => (
            <li key={candidate} role="option" aria-selected={candidate === locale}>
              {/* A plain anchor, not next/link: switching language changes
                  `<html lang>` and `<html dir>`, which live in the layout of
                  the segment being replaced. A full document load is the only
                  way those attributes - and the per-script font tokens that
                  hang off them - are guaranteed to be correct. */}
              <a
                href={hrefFor(candidate)}
                hrefLang={candidate}
                className={`flex items-center gap-3 px-4 py-2 text-[15px] font-semibold transition-colors hover:bg-brand-soft ${
                  candidate === locale ? "text-brand" : "text-ink"
                }`}
              >
                <span className="w-6 text-[12px] font-bold text-muted">
                  {LOCALE_CODES[candidate]}
                </span>
                {LOCALE_NAMES[candidate]}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
