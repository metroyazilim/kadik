/**
 * Field schema for the KADİK page editor. One definition drives three
 * things: the admin form (`KadikPageEditor`), server-side validation on save
 * (`sanitizeKadikPageData`) and the public merge over factory defaults. A
 * value that is not described here can never reach the database or the site.
 *
 * Pure data - safe to import from client and server code alike.
 */

export type KadikScalarKind = "text" | "textarea" | "date" | "url" | "image" | "select";

export type KadikSelectOption = Readonly<{ value: string; label: string }>;

export type KadikScalarField = Readonly<{
  kind: KadikScalarKind;
  /** Dotted path relative to the owning section's `base`. */
  key: string;
  label: string;
  hint?: string;
  options?: readonly KadikSelectOption[];
}>;

export type KadikListField = Readonly<{
  kind: "list";
  key: string;
  label: string;
  hint?: string;
  itemLabel: string;
  /** Which sub-field names each row in the collapsed list. */
  titleKey: string;
  fields: readonly KadikScalarField[];
  max?: number;
}>;

export type KadikStringListField = Readonly<{
  kind: "stringList";
  key: string;
  label: string;
  hint?: string;
  itemLabel: string;
  max?: number;
}>;

export type KadikField = KadikScalarField | KadikListField | KadikStringListField;

export type KadikSection = Readonly<{
  id: string;
  title: string;
  description?: string;
  /** Dotted path prefix inside the page data, e.g. `"home"` or `"seo"`. */
  base: string;
  fields: readonly KadikField[];
}>;

export const MAX_TEXT_LENGTH = 20_000;
export const DEFAULT_LIST_MAX = 200;

export function joinPath(...parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join(".");
}

export function getAtPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Returns a new object with `value` written at `path` (structural copy along the path only). */
export function setAtPath<T>(source: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const base = (source !== null && typeof source === "object" && !Array.isArray(source) ? source : {}) as Record<string, unknown>;
  if (rest.length === 0) return { ...base, [head]: value } as T;
  return { ...base, [head]: setAtPath(base[head], rest.join("."), value) } as T;
}
