"use client";

import { TranslationAssistant } from "@/components/admin/TranslationAssistant";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n/config";
import { fieldInput, fieldLabel, primaryButton, secondaryButton } from "@/components/admin/ui";
import type { Dictionary } from "@/lib/i18n/types";
import {
  PAGE_COPY_DEFINITIONS,
  pageCopyGroups,
  type PageCopyKey,
} from "@/lib/page-copy-registry";
import { savePageCopyAction } from "./copy-actions";

const LOCALES: readonly Locale[] = ["tr", "en"];

export function PageCopyEditor({
  pageKey,
  dictionaries,
}: {
  pageKey: PageCopyKey;
  dictionaries: Readonly<Record<Locale, Dictionary>>;
}) {
  const [locale, setLocale] = useState<Locale>("tr");
  const [valuesByLocale, setValuesByLocale] = useState(() =>
    Object.fromEntries(
      LOCALES.map((currentLocale) => [
        currentLocale,
        Object.fromEntries(
          pageCopyGroups(pageKey, dictionaries[currentLocale])
            .flatMap((group) => group.fields)
            .map((field) => [field.path, field.value]),
        ),
      ]),
    ) as Record<Locale, Record<string, string>>,
  );
  const [message, setMessage] = useState<{ status: "success" | "error"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const definition = PAGE_COPY_DEFINITIONS[pageKey];
  const groups = useMemo(() => pageCopyGroups(pageKey, dictionaries[locale]), [pageKey, dictionaries, locale]);
  const currentValues = valuesByLocale[locale];

  function update(path: string, value: string) {
    setValuesByLocale((current) => ({
      ...current,
      [locale]: { ...current[locale], [path]: value },
    }));
  }

  function save() {
    startSaving(async () => {
      const result = await savePageCopyAction(pageKey, locale, currentValues);
      setMessage({ status: result.status, text: result.message });
    });
  }

  /** The AI returns one object per locale keyed by the same dotted copy
   * paths; each locale is written through the same save action the manual
   * form uses, so nothing bypasses its validation or audit entry. */
  async function applyTranslations(translations: Record<string, unknown>) {
    const applied: Record<string, Record<string, string>> = {};
    for (const target of LOCALES) {
      if (target === "tr") continue;
      const candidate = translations[target];
      if (!candidate || typeof candidate !== "object") continue;
      const values: Record<string, string> = { ...valuesByLocale[target] };
      for (const [path, value] of Object.entries(candidate as Record<string, unknown>)) {
        if (typeof value === "string" && path in values) values[path] = value;
      }
      const result = await savePageCopyAction(pageKey, target, values);
      if (result.status === "error") return { error: `${target.toUpperCase()}: ${result.message}` };
      applied[target] = values;
    }
    setValuesByLocale((current) => ({ ...current, ...applied }));
    return { success: "Çeviriler kaydedildi ve yayına alındı." };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-4">
        <div>
          <p className="text-sm font-semibold text-brand-text">{definition.description}</p>
          <p className="mt-1 font-mono text-xs text-brand-muted">Public: {definition.publicPath}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {definition.collectionHref ? (
            <Link href={definition.collectionHref} className={secondaryButton}>
              {definition.collectionLabel}
            </Link>
          ) : null}
          {definition.settingsHref ? (
            <Link href={definition.settingsHref} className={secondaryButton}>
              {definition.settingsLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Sayfa metni dilleri">
        {LOCALES.map((currentLocale) => (
          <button
            key={currentLocale}
            type="button"
            onClick={() => {
              setLocale(currentLocale);
              setMessage(null);
            }}
            className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-bold uppercase ${
              locale === currentLocale
                ? "border-brand-primary bg-brand-primary text-brand-on-invert"
                : "border-brand-border bg-brand-surface text-brand-muted"
            }`}
          >
            {currentLocale}
          </button>
        ))}
      </div>
        <TranslationAssistant source={valuesByLocale.tr} onApply={applyTranslations} />
      </div>

      {groups.map((group) => (
        <section key={group.label} className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-5">
          <h2 className="border-b border-brand-border pb-3 text-sm font-bold text-brand-text">{group.label}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {group.fields.map((field) => {
              const value = currentValues[field.path] ?? "";
              const long = value.length > 100 || /description|intro|text|summary|notice/i.test(field.path);
              return (
                <label key={field.path} className={fieldLabel}>
                  {field.label}
                  {long ? (
                    <textarea
                      className={fieldInput}
                      value={value}
                      rows={4}
                      onChange={(event) => update(field.path, event.target.value)}
                    />
                  ) : (
                    <input
                      className={fieldInput}
                      value={value}
                      onChange={(event) => update(field.path, event.target.value)}
                    />
                  )}
                  <span className="font-mono text-[10px] font-normal normal-case tracking-normal text-brand-muted">{field.path}</span>
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-4 shadow-lg">
        <p className={`text-xs font-semibold ${message?.status === "error" ? "text-brand-danger" : "text-brand-success"}`}>
          {message?.text ?? "Bu ekran yalnız sayfanın sabit metinlerini değiştirir; component yapısı kodda kalır."}
        </p>
        <button type="button" onClick={save} disabled={isSaving} className={primaryButton}>
          {isSaving ? "Kaydediliyor…" : "Kaydet ve yayınla"}
        </button>
      </div>
    </div>
  );
}
