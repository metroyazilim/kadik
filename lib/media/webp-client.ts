"use client";

/**
 * Every raster image entering the media library is normalized to WebP at
 * quality 0.85 before it is uploaded. Uploads go straight from the browser
 * to R2 with a presigned ticket (the bytes never pass through a server
 * action), so the browser is the only place that can re-encode them - a
 * server-side `sharp` pass would require routing every file through the
 * app server and giving up the direct-upload path entirely.
 *
 * SVG is vector and PDF is a document: both are passed through untouched.
 * Animated GIF is also passed through - a canvas re-encode would silently
 * flatten it to its first frame, which is data loss, not compression.
 */
export const WEBP_QUALITY = 0.85;

const CONVERTIBLE_MIME_TYPES: Readonly<Record<string, true>> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("decode-failed"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns a WebP `File` at {@link WEBP_QUALITY}, or the original file when
 * it is not a convertible raster image or when the browser cannot encode
 * WebP. Never throws: a conversion failure degrades to the original bytes
 * so an upload is never lost to an encoder quirk.
 */
export async function toWebpFile(file: File): Promise<File> {
  if (CONVERTIBLE_MIME_TYPES[file.type] !== true) return file;

  try {
    const source = await decodeImage(file);
    const width = source.width;
    const height = source.height;
    if (!width || !height) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(source, 0, 0, width, height);
    if ("close" in source) source.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
    });
    // A browser without WebP encoding support silently hands back a PNG.
    if (!blob || blob.type !== "image/webp") return file;

    return new File([blob], `${file.name.replace(/\.[^./\\]+$/, "") || "image"}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
