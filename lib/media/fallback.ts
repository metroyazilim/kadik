import type { ContentLocale } from "@prisma/client";
import type { MediaAssetDto, MediaKind, MediaMimeType } from "./types";

export type ResolvedMediaView = Readonly<{
  url: string;
  altText: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  isFallback: boolean;
  kind: MediaKind;
}>;

export const DEFAULT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Cpath d='M160 130a20 20 0 1 0 0-40 20 20 0 0 0 0 40zm-40 90h160l-50-65-35 45-25-30-50 50z' fill='%2394a3b8'/%3E%3Ctext x='50%25' y='85%25' text-anchor='middle' font-family='system-ui,sans-serif' font-size='14' fill='%2364748b'%3EG%C3%B6rsel Haz%C4%B1rlan%C4%B1yor%3C/text%3E%3C/svg%3E";

export const DEFAULT_DOCUMENT_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Cpath d='M140 70h80l40 40v120h-120V70zm75 5v30h30l-30-30z' fill='%2394a3b8'/%3E%3Ctext x='50%25' y='85%25' text-anchor='middle' font-family='system-ui,sans-serif' font-size='14' fill='%2364748b'%3EBelge Haz%C4%B1rlan%C4%B1yor%3C/text%3E%3C/svg%3E";

export type MediaInputCandidate =
  | MediaAssetDto
  | {
      url?: string | null;
      altText?: string | null;
      caption?: string | null;
      width?: number | null;
      height?: number | null;
      mimeType?: string | null;
    }
  | string
  | null
  | undefined;

export function resolveMediaOrFallback(
  input: MediaInputCandidate,
  options?: {
    fallbackKind?: MediaKind;
    defaultAlt?: string;
    locale?: ContentLocale;
  }
): ResolvedMediaView {
  const fallbackKind = options?.fallbackKind || "image";
  const defaultAlt = options?.defaultAlt || (fallbackKind === "image" ? "Görsel" : "Belge");

  if (!input) {
    return {
      url: fallbackKind === "image" ? DEFAULT_IMAGE_PLACEHOLDER : DEFAULT_DOCUMENT_PLACEHOLDER,
      altText: defaultAlt,
      caption: null,
      width: fallbackKind === "image" ? 400 : 400,
      height: fallbackKind === "image" ? 300 : 300,
      mimeType: fallbackKind === "image" ? "image/svg+xml" : "application/pdf",
      isFallback: true,
      kind: fallbackKind,
    };
  }

  // If input is a raw string URL
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return resolveMediaOrFallback(null, options);
    }
    const isPdf = trimmed.toLowerCase().endsWith(".pdf");
    const kind: MediaKind = isPdf ? "document" : "image";
    return {
      url: trimmed,
      altText: defaultAlt,
      caption: null,
      width: null,
      height: null,
      mimeType: isPdf ? "application/pdf" : "image/jpeg",
      isFallback: false,
      kind,
    };
  }

  // If input is an object (a full MediaAssetDto or a lightweight shape).
  // A MediaAssetDto that is archived or whose storage was found MISSING
  // (Story 4.3) falls back to the placeholder exactly like a null/empty
  // reference - the row still exists for audit/admin purposes, but public
  // and preview renderers never receive its real URL once either flag is
  // set, and never see which flag it was (that distinction is admin-only).
  if (typeof input === "object") {
    const isBrokenAsset =
      "archivedAt" in input &&
      (input.archivedAt !== null || ("storageStatus" in input && input.storageStatus === "MISSING"));
    if (isBrokenAsset) {
      return resolveMediaOrFallback(null, options);
    }

    const url = input.url?.trim();
    if (!url) {
      return resolveMediaOrFallback(null, options);
    }

    const mimeType = input.mimeType || (url.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const kind: MediaKind = mimeType === "application/pdf" ? "document" : "image";
    const altText = input.altText?.trim() || defaultAlt;
    const caption = input.caption?.trim() || null;
    const width = typeof input.width === "number" ? input.width : null;
    const height = typeof input.height === "number" ? input.height : null;

    return {
      url,
      altText,
      caption,
      width,
      height,
      mimeType,
      isFallback: false,
      kind,
    };
  }

  return resolveMediaOrFallback(null, options);
}
