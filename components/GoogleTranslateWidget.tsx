"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { KadikLocale } from "@/lib/kadik-i18n";

interface GoogleTranslateElementOptions {
  pageLanguage: KadikLocale;
  includedLanguages: string;
  layout: string;
  autoDisplay: boolean;
}

interface GoogleTranslateElementConstructor {
  readonly InlineLayout: {
    readonly SIMPLE: string;
  };
  new (options: GoogleTranslateElementOptions, elementId: string): unknown;
}

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: GoogleTranslateElementConstructor;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

const GOOGLE_TRANSLATE_ELEMENT_ID = "google_translate_element";
const GOOGLE_TRANSLATE_SCRIPT_SRC =
  "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";

const LANGUAGES = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "ar", flag: "🇸🇦", label: "العربية" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "it", flag: "🇮🇹", label: "Italiano" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];

let googleTranslateScriptInjected = false;
let currentPageLanguage: KadikLocale = "en";

function initializeGoogleTranslate(pageLanguage: KadikLocale) {
  const element = document.getElementById(GOOGLE_TRANSLATE_ELEMENT_ID);
  const TranslateElement = window.google?.translate?.TranslateElement;

  if (!element || !TranslateElement) {
    return;
  }

  element.innerHTML = "";
  new TranslateElement(
    {
      pageLanguage,
      includedLanguages: LANGUAGES.map(({ code }) => code).join(","),
      layout: TranslateElement.InlineLayout.SIMPLE,
      autoDisplay: false,
    },
    GOOGLE_TRANSLATE_ELEMENT_ID,
  );
}

function getCookieLanguage(pageLanguage: KadikLocale): LanguageCode {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("googtrans="));
  const match = cookie?.match(/^googtrans=\/(?:en|tr)\/([a-z]{2})$/);
  const code = match?.[1];

  return LANGUAGES.some((language) => language.code === code)
    ? (code as LanguageCode)
    : pageLanguage;
}

/** Module scope (outside any component/hook): the compiler's render-purity
 * check only tracks mutations reachable from a component/hook body, and
 * `document.cookie = ...` has no non-mutating equivalent - it's the only
 * way the browser exposes cookie writes. */
function applyGoogleTranslateCookie(pageLanguage: KadikLocale, code: LanguageCode) {
  if (code === pageLanguage) {
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
  } else {
    document.cookie = `googtrans=/${pageLanguage}/${code}; path=/`;
    document.cookie = `googtrans=/${pageLanguage}/${code}; path=/; domain=${window.location.hostname}`;
  }
}

function noopSubscribe() {
  return () => {};
}

/**
 * Google's translate widget injects its own cross-origin stylesheet
 * (`translate.googleapis.com`) for the top "Şu dile çevrildi" banner it
 * adds as `<body>`'s first child, which always wins the cascade over any
 * same-page `!important` rule regardless of selector specificity. Forcing
 * an inline `!important` style on the node is the only override that
 * always beats an external stylesheet - but Google's own script also
 * resets that inline `style` attribute on its own schedule afterward,
 * without a matching, reliably-observable DOM mutation (confirmed: an
 * attribute `MutationObserver` on the node misses the reset). A short
 * poll is the only mechanism that reliably wins this fight.
 */
function isBannerNode(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.parentElement === document.body && node.classList.contains("skiptranslate");
}

export default function GoogleTranslateWidget({
  pageLanguage,
}: {
  pageLanguage: KadikLocale;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // `googtrans` is a browser-only cookie unavailable during SSR - a no-op
  // subscription with `pageLanguage` as the server snapshot keeps the first
  // client render hydration-safe, then re-syncs from the real cookie.
  const currentLanguage = useSyncExternalStore(
    noopSubscribe,
    () => getCookieLanguage(pageLanguage),
    () => pageLanguage,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      for (const node of Array.from(document.body.children)) {
        if (isBannerNode(node)) node.style.setProperty("display", "none", "important");
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    currentPageLanguage = pageLanguage;

    if (window.google?.translate?.TranslateElement) {
      initializeGoogleTranslate(pageLanguage);
      return;
    }

    window.googleTranslateElementInit = () => {
      initializeGoogleTranslate(currentPageLanguage);
    };

    if (googleTranslateScriptInjected) {
      return;
    }

    googleTranslateScriptInjected = true;
    const script = document.createElement("script");
    script.src = GOOGLE_TRANSLATE_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, [pageLanguage]);

  function selectLanguage(code: LanguageCode) {
    applyGoogleTranslateCookie(pageLanguage, code);
    window.location.reload();
  }

  const activeLanguage =
    LANGUAGES.find(({ code }) => code === currentLanguage) ?? LANGUAGES[0];

  return (
    <div ref={containerRef} className="kadik-translate">
      <button
        ref={toggleRef}
        type="button"
        className="kadik-translate-toggle"
        aria-label={`Change language, current language: ${activeLanguage.label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true">{activeLanguage.flag}</span>
      </button>

      {isOpen ? (
        <div className="kadik-translate-menu" role="menu">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              role="menuitem"
              aria-current={language.code === currentLanguage ? "true" : undefined}
              onClick={() => selectLanguage(language.code)}
            >
              <span aria-hidden="true">{language.flag}</span>
              <span>{language.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div id={GOOGLE_TRANSLATE_ELEMENT_ID} />
    </div>
  );
}
