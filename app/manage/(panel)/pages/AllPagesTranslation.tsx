"use client";

import { useEffect, useState } from "react";
import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import { exportAllPageCopyAction, importAllPageCopyAction } from "./copy-actions";

/**
 * Site-wide page-copy translation: one prompt covering every page's fixed
 * strings, one paste writing them all. Per-page assistants still exist for
 * touching a single page; this is the bulk path so the whole site can be
 * localised in a single round trip.
 */
export function AllPagesTranslation() {
  const [source, setSource] = useState<Record<string, Record<string, string>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    exportAllPageCopyAction().then((result) => {
      if (cancelled || !("source" in result)) return;
      setSource(result.source);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!source) return null;

  return (
    <TranslationAssistant
      source={source}
      onApply={async (translations) => {
        const result = await importAllPageCopyAction(translations);
        return result.status === "error" ? { error: result.message } : { success: result.message };
      }}
    />
  );
}
