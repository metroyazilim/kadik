import { createHash } from "node:crypto";
import type {
  MediaExtension,
  MediaKind,
  MediaMimeType,
  ValidatedMediaInput,
} from "./types";

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_SVG_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const MIME_EXTENSION_MAP: Readonly<Record<MediaMimeType, readonly MediaExtension[]>> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/svg+xml": [".svg"],
  "application/pdf": [".pdf"],
};

export const EXTENSION_MIME_MAP: Readonly<Record<MediaExtension, MediaMimeType>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export class MediaValidationError extends Error {
  readonly code:
    | "emptyFile"
    | "unsupportedType"
    | "mismatchedExtension"
    | "fakeContentType"
    | "fileTooLarge"
    | "invalidSvg"
    | "pathTraversal"
    | "invalidExternalUrl";

  constructor(
    code:
      | "emptyFile"
      | "unsupportedType"
      | "mismatchedExtension"
      | "fakeContentType"
      | "fileTooLarge"
      | "invalidSvg"
      | "pathTraversal"
      | "invalidExternalUrl",
    message: string
  ) {
    super(message);
    this.name = "MediaValidationError";
    this.code = code;
  }
}

/**
 * Sanitizes a user-supplied filename to prevent path traversal,
 * control character injection, or illegal characters.
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || typeof rawName !== "string") {
    return "unnamed-asset";
  }

  // Normalize Unicode (NFC)
  const normalized = rawName.normalize("NFC");

  // Remove null bytes and control characters
  const cleanChars = normalized.replace(/[\x00-\x1F\x7F]/g, "");

  // Extract base filename (strip any path delimiters / traversal)
  const baseName = cleanChars
    .replace(/^.*[\\/]/, "")
    .replace(/\.\.+/g, ".")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!baseName || baseName === "." || baseName === "-") {
    return "unnamed-asset";
  }

  return baseName.slice(0, 120);
}

/**
 * Detects the real content type from file magic bytes.
 */
export function detectMagicBytes(buffer: Buffer): MediaMimeType | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // 3. GIF: GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // 4. WebP: RIFF (52 49 46 46) .... WEBP (57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // 5. PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "application/pdf";
  }

  // 6. SVG: check if text contains <svg
  const headerText = buffer.slice(0, 1024).toString("utf-8").trim().toLowerCase();
  if (
    headerText.includes("<svg") ||
    (headerText.includes("<?xml") && headerText.includes("<svg"))
  ) {
    return "image/svg+xml";
  }

  return null;
}

/**
 * Validates SVG content against XSS / script injection.
 */
export function validateSvgSecurity(svgText: string): void {
  const lower = svgText.toLowerCase();

  const forbiddenPatterns = [
    /<script\b/i,
    /<\/script>/i,
    /javascript:/i,
    /\bonerror\s*=/i,
    /\bonload\s*=/i,
    /\bonclick\s*=/i,
    /\bonmouseover\s*=/i,
    /<foreignobject\b/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<applet\b/i,
    /data:text\/html/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(lower)) {
      throw new MediaValidationError(
        "invalidSvg",
        "SVG contains dangerous executable scripts or embedded objects."
      );
    }
  }
}

/**
 * Extracts width and height dimensions from supported image formats.
 */
export function extractDimensions(
  buffer: Buffer,
  mimeType: MediaMimeType
): { width: number | null; height: number | null } {
  try {
    switch (mimeType) {
      case "image/png": {
        if (buffer.length >= 24) {
          // PNG width is at offset 16 (4 bytes big-endian), height at 20 (4 bytes big-endian)
          const width = buffer.readUInt32BE(16);
          const height = buffer.readUInt32BE(20);
          return { width: width > 0 ? width : null, height: height > 0 ? height : null };
        }
        break;
      }
      case "image/gif": {
        if (buffer.length >= 10) {
          // GIF width is at offset 6 (2 bytes little-endian), height at 8 (2 bytes little-endian)
          const width = buffer.readUInt16LE(6);
          const height = buffer.readUInt16LE(8);
          return { width: width > 0 ? width : null, height: height > 0 ? height : null };
        }
        break;
      }
      case "image/jpeg": {
        let offset = 2;
        while (offset < buffer.length) {
          if (buffer[offset] !== 0xff) {
            break;
          }
          const marker = buffer[offset + 1];
          // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
          if (
            marker === 0xc0 ||
            marker === 0xc1 ||
            marker === 0xc2 ||
            marker === 0xc3 ||
            marker === 0xc5 ||
            marker === 0xc6 ||
            marker === 0xc7 ||
            marker === 0xc9 ||
            marker === 0xca ||
            marker === 0xcb
          ) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width: width > 0 ? width : null, height: height > 0 ? height : null };
          }
          // Length of current marker segment
          const segmentLength = buffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        }
        break;
      }
      case "image/webp": {
        if (buffer.length >= 30) {
          // VP8 lossy
          if (buffer.slice(12, 16).toString("ascii") === "VP8 ") {
            const width = buffer.readUInt16LE(26) & 0x3fff;
            const height = buffer.readUInt16LE(28) & 0x3fff;
            return { width: width > 0 ? width : null, height: height > 0 ? height : null };
          }
          // VP8L lossless
          if (buffer.slice(12, 16).toString("ascii") === "VP8L") {
            const b0 = buffer[21];
            const b1 = buffer[22];
            const b2 = buffer[23];
            const b3 = buffer[24];
            const width = 1 + (((b1 & 0x3f) << 8) | b0);
            const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
            return { width: width > 0 ? width : null, height: height > 0 ? height : null };
          }
          // VP8X extended
          if (buffer.slice(12, 16).toString("ascii") === "VP8X") {
            const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
            const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
            return { width: width > 0 ? width : null, height: height > 0 ? height : null };
          }
        }
        break;
      }
      case "image/svg+xml": {
        const svgString = buffer.toString("utf-8");
        const viewBoxMatch = svgString.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
        if (viewBoxMatch) {
          const w = Math.round(parseFloat(viewBoxMatch[3]));
          const h = Math.round(parseFloat(viewBoxMatch[4]));
          if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            return { width: w, height: h };
          }
        }
        const widthMatch = svgString.match(/width=["']\s*([\d.]+)(?:px)?\s*["']/i);
        const heightMatch = svgString.match(/height=["']\s*([\d.]+)(?:px)?\s*["']/i);
        if (widthMatch && heightMatch) {
          const w = Math.round(parseFloat(widthMatch[1]));
          const h = Math.round(parseFloat(heightMatch[1]));
          if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            return { width: w, height: h };
          }
        }
        break;
      }
      default:
        break;
    }
  } catch {
    // Dimension extraction failure is non-fatal for non-critical assets
  }

  return { width: null, height: null };
}

/**
 * Computes SHA-256 hex checksum of buffer.
 */
export function calculateChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validates complete upload input buffer against strict security, MIME, magic bytes,
 * and size constraints.
 */
export function validateUploadBuffer(
  buffer: Buffer,
  originalFilename: string,
  claimedMimeType?: string
): ValidatedMediaInput {
  if (!buffer || buffer.length === 0) {
    throw new MediaValidationError("emptyFile", "Uploaded file cannot be empty.");
  }

  const sanitizedFilename = sanitizeFilename(originalFilename);
  const extMatch = sanitizedFilename.match(/\.[a-zA-Z0-9]+$/);
  const ext = (extMatch ? extMatch[0].toLowerCase() : "") as MediaExtension;

  if (!ext || !(ext in EXTENSION_MIME_MAP)) {
    throw new MediaValidationError(
      "unsupportedType",
      `Unsupported file extension: ${ext || "none"}. Supported: ${Object.keys(EXTENSION_MIME_MAP).join(", ")}`
    );
  }

  const expectedMime = EXTENSION_MIME_MAP[ext];
  const detectedMime = detectMagicBytes(buffer);

  if (!detectedMime) {
    throw new MediaValidationError(
      "fakeContentType",
      "File content does not match any allowed media format."
    );
  }

  // For JPEG, allow both .jpg and .jpeg
  if (detectedMime !== expectedMime) {
    throw new MediaValidationError(
      "mismatchedExtension",
      `File extension '${ext}' does not match detected format '${detectedMime}'.`
    );
  }

  if (claimedMimeType && claimedMimeType !== detectedMime) {
    // Check if both are JPEG aliases or standard
    const isJpegMatch =
      (claimedMimeType === "image/jpeg" || claimedMimeType === "image/jpg") &&
      detectedMime === "image/jpeg";

    if (!isJpegMatch && claimedMimeType !== detectedMime) {
      throw new MediaValidationError(
        "fakeContentType",
        `Claimed MIME type '${claimedMimeType}' does not match verified content '${detectedMime}'.`
      );
    }
  }

  // Enforce size limits per type
  if (detectedMime === "image/svg+xml") {
    if (buffer.length > MAX_SVG_SIZE_BYTES) {
      throw new MediaValidationError(
        "fileTooLarge",
        `SVG file exceeds maximum allowed size of ${MAX_SVG_SIZE_BYTES / (1024 * 1024)}MB.`
      );
    }
    validateSvgSecurity(buffer.toString("utf-8"));
  } else if (detectedMime === "application/pdf") {
    if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
      throw new MediaValidationError(
        "fileTooLarge",
        `PDF file exceeds maximum allowed size of ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB.`
      );
    }
  } else {
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new MediaValidationError(
        "fileTooLarge",
        `Image file exceeds maximum allowed size of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`
      );
    }
  }

  const dimensions = extractDimensions(buffer, detectedMime);
  const checksum = calculateChecksum(buffer);
  const kind: MediaKind = detectedMime === "application/pdf" ? "document" : "image";

  return {
    buffer,
    filename: originalFilename,
    sanitizedFilename,
    extension: ext,
    mimeType: detectedMime,
    byteSize: buffer.length,
    width: dimensions.width,
    height: dimensions.height,
    checksum,
    kind,
  };
}

/**
 * Validates a media URL to ensure it belongs to an authorized origin or custom domain,
 * preventing arbitrary external URL injection or SSRF vectors.
 */
export function validateMediaUrl(
  url: string,
  allowedOrigins: readonly string[] = []
): boolean {
  if (!url || typeof url !== "string") return false;

  // Relative URLs are safe (e.g. /media/... or /brand/...)
  if (url.startsWith("/")) {
    return !url.startsWith("//") && !url.includes("..");
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    if (allowedOrigins.length > 0) {
      return allowedOrigins.some((origin) => {
        try {
          const allowedParsed = new URL(origin);
          return (
            parsed.hostname === allowedParsed.hostname ||
            parsed.hostname.endsWith(`.${allowedParsed.hostname}`)
          );
        } catch {
          return parsed.hostname === origin || parsed.hostname.endsWith(`.${origin}`);
        }
      });
    }

    return true;
  } catch {
    return false;
  }
}
