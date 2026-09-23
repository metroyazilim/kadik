import type { KadikImage } from "@/lib/kadik-i18n";
import { DEFAULT_LIST_MAX, MAX_TEXT_LENGTH, getAtPath, setAtPath, type KadikScalarField } from "./fields";
import { kadikPageDefaults, kadikPageFields, type KadikContentKey, type KadikPageData } from "./pages";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CUID_PATTERN = /^[a-z0-9]{8,64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isKadikImage(value: unknown): value is KadikImage {
  if (!isRecord(value) || typeof value.url !== "string") return false;
  return value.assetId === null || (typeof value.assetId === "string" && CUID_PATTERN.test(value.assetId));
}

/** Returns the validated value, or `undefined` when it does not fit the field. */
function scalar(field: KadikScalarField, value: unknown): unknown {
  switch (field.kind) {
    case "image":
      return isKadikImage(value) ? { url: value.url.slice(0, 2_000), assetId: value.assetId } : undefined;
    case "date":
      return typeof value === "string" && (value === "" || DATE_PATTERN.test(value)) ? value : undefined;
    case "select":
      return typeof value === "string" && field.options?.some((option) => option.value === value) ? value : undefined;
    case "url":
      if (typeof value !== "string") return undefined;
      // Only http(s), mailto, site-relative paths or in-page anchors - never `javascript:`.
      return value === "" || /^(https?:\/\/|mailto:|\/|#)/i.test(value.trim()) ? value.trim().slice(0, 2_000) : undefined;
    default:
      return typeof value === "string" ? value.slice(0, MAX_TEXT_LENGTH) : undefined;
  }
}

function emptyFor(field: KadikScalarField): unknown {
  if (field.kind === "image") return { url: "", assetId: null } satisfies KadikImage;
  if (field.kind === "select") return field.options?.[0]?.value ?? "";
  return "";
}

/**
 * Validates arbitrary input against the page schema and merges it over the
 * factory defaults. Every described field ends up with a well-typed value;
 * anything not described is dropped. Used both when saving (input from the
 * admin form) and when rendering (JSON read back from the database).
 */
export function sanitizeKadikPageData(key: KadikContentKey, input: unknown): KadikPageData {
  let result: KadikPageData = kadikPageDefaults(key);
  if (!isRecord(input)) return result;

  for (const { path, field } of kadikPageFields(key)) {
    const raw = getAtPath(input, path);
    if (raw === undefined) continue;

    if (field.kind === "list") {
      if (!Array.isArray(raw)) continue;
      const items = raw.slice(0, field.max ?? DEFAULT_LIST_MAX).flatMap((item) => {
        if (!isRecord(item)) return [];
        const clean: Record<string, unknown> = {};
        for (const sub of field.fields) {
          const value = scalar(sub, item[sub.key]);
          clean[sub.key] = value === undefined ? emptyFor(sub) : value;
        }
        return [clean];
      });
      result = setAtPath(result, path, items);
      continue;
    }

    if (field.kind === "stringList") {
      if (!Array.isArray(raw)) continue;
      const items = raw
        .slice(0, field.max ?? DEFAULT_LIST_MAX)
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.slice(0, MAX_TEXT_LENGTH));
      result = setAtPath(result, path, items);
      continue;
    }

    const value = scalar(field, raw);
    if (value !== undefined) result = setAtPath(result, path, value);
  }

  return result;
}

/** Every image slot in validated page data, with the path it lives at. */
export function collectKadikImages(key: KadikContentKey, data: KadikPageData): readonly Readonly<{ path: string; image: KadikImage }>[] {
  const found: { path: string; image: KadikImage }[] = [];
  for (const { path, field } of kadikPageFields(key)) {
    if (field.kind === "image") {
      const value = getAtPath(data, path);
      if (isKadikImage(value)) found.push({ path, image: value });
    } else if (field.kind === "list") {
      const items = getAtPath(data, path);
      if (!Array.isArray(items)) continue;
      items.forEach((item, index) => {
        for (const sub of field.fields) {
          if (sub.kind !== "image" || !isRecord(item)) continue;
          const value = item[sub.key];
          if (isKadikImage(value)) found.push({ path: `${path}.${index}.${sub.key}`, image: value });
        }
      });
    }
  }
  return found;
}

/** Replaces the image at a path produced by `collectKadikImages` (handles `list.N.field`). */
export function replaceKadikImage(data: KadikPageData, path: string, image: KadikImage): KadikPageData {
  const match = /^(.*)\.(\d+)\.([^.]+)$/.exec(path);
  if (!match) return setAtPath(data, path, image);
  const [, listPath, indexText, subKey] = match;
  const list = getAtPath(data, listPath);
  if (!Array.isArray(list)) return data;
  const index = Number(indexText);
  const next = list.map((item, position) => (position === index && isRecord(item) ? { ...item, [subKey]: image } : item));
  return setAtPath(data, listPath, next);
}
