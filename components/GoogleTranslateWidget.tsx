"use client";

import { useEffect } from "react";

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
      includedLanguages: "fr,de,es,ar,ru,it",
      layout: TranslateElement.InlineLayout.SIMPLE,
      autoDisplay: false,
    },
    GOOGLE_TRANSLATE_ELEMENT_ID,
  );
}

export default function GoogleTranslateWidget({
  pageLanguage,
}: {
  pageLanguage: KadikLocale;
}) {
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

  // The widget intentionally has no external CSS dependency.
  return (
    <div
      id={GOOGLE_TRANSLATE_ELEMENT_ID}
      className="kadik-google-translate"
      style={{ minWidth: 90 }}
    />
  );
}
