import type { PrismaClient } from "@prisma/client";

/**
 * Server-side enforcement of FR-14/AC-FR14-04: an image URL is only ever
 * accepted if it resolves to an existing, non-archived `MediaAsset`. This is
 * the trust boundary the UI's `MediaField`/`MediaPickerModal` alone cannot
 * provide - a request that bypasses the picker (direct API/form POST) is
 * rejected here regardless of what the client sent.
 *
 * Empty/null input is always allowed (the field is optional); a non-empty
 * value must match the library. Takes `client: PrismaClient` (not a
 * module-level singleton import) for the same reason every other function
 * in `lib/media/service.ts` does: a test's isolated per-run schema client
 * can exercise this against real `MediaAsset` rows.
 */
export async function assertImageUrlInLibrary(client: PrismaClient, url: string | null | undefined): Promise<void> {
  const value = url?.trim();
  if (!value) return;
  const asset = await client.mediaAsset.findFirst({ where: { url: value, archivedAt: null }, select: { id: true } });
  if (!asset) {
    throw new MediaLibraryUrlError(value);
  }
}

/**
 * Validates every non-empty entry in a gallery-style list of image URLs
 * against the library (AC-FR14-05). Returns nothing; throws on the first
 * offending entry.
 */
export async function assertImageUrlsInLibrary(client: PrismaClient, urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    await assertImageUrlInLibrary(client, url);
  }
}

export class MediaLibraryUrlError extends Error {
  constructor(public readonly url: string) {
    super(`"${url}" medya kütüphanesinde kayıtlı değil. Görseli önce medya kütüphanesinden seçin veya yükleyin.`);
    this.name = "MediaLibraryUrlError";
  }
}
