"use client";

import { useEffect, useRef, useState } from "react";
import { slugifyTitle } from "@/lib/content-model/slugify";
import { fieldHint, fieldInput, fieldLabel } from "./ui";

/**
 * Read-only mirror of the address a record will publish under. The slug is
 * never typed: the server derives it from the title on both save and
 * publish, and this field only shows the admin what that derivation
 * produces. It submits nothing (no `name`), so there is no second source of
 * truth that could drift from the stored payload.
 */
export function SlugPreview({
  sourceName,
  initialValue,
  label = "Adres (slug)",
}: Readonly<{ sourceName: string; initialValue: string; label?: string }>) {
  const rootRef = useRef<HTMLLabelElement>(null);
  const [slug, setSlug] = useState(() => slugifyTitle(initialValue));

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    const field = form?.elements.namedItem(sourceName);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;

    setSlug(slugifyTitle(field.value));
    const handle = () => setSlug(slugifyTitle(field.value));
    field.addEventListener("input", handle);
    return () => field.removeEventListener("input", handle);
  }, [sourceName]);

  return (
    <label className={fieldLabel} ref={rootRef}>
      {label}
      <input className={fieldInput} value={slug} readOnly tabIndex={-1} aria-readonly="true" />
      <span className={fieldHint}>Başlıktan otomatik üretilir; elle düzenlenmez.</span>
    </label>
  );
}
