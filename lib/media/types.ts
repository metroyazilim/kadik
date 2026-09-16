import type { ContentLocale } from "@prisma/client";
import type { AdminContext } from "../content-model/admin-context";

export type MediaMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/svg+xml"
  | "application/pdf";

export type MediaExtension =
  | ".jpg"
  | ".jpeg"
  | ".png"
  | ".webp"
  | ".gif"
  | ".svg"
  | ".pdf";

export type MediaKind = "image" | "document";

export type ValidatedMediaInput = Readonly<{
  buffer: Buffer;
  filename: string;
  sanitizedFilename: string;
  extension: MediaExtension;
  mimeType: MediaMimeType;
  byteSize: number;
  width: number | null;
  height: number | null;
  checksum: string;
  kind: MediaKind;
}>;

export type MediaStorageStatus = "ACTIVE" | "MISSING";

export type MediaAssetDto = Readonly<{
  id: string;
  filename: string;
  objectKey: string;
  url: string;
  mimeType: MediaMimeType;
  extension: MediaExtension;
  byteSize: number;
  width: number | null;
  height: number | null;
  checksum: string;
  altText: string | null;
  caption: string | null;
  /** Derived from `archivedAt !== null` - kept for backward-compatible
   * boolean checks across the admin UI. `archivedAt` is the source of truth. */
  archived: boolean;
  archivedAt: Date | null;
  storageStatus: MediaStorageStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number;
  /** `true` only on a `createMediaAsset` response that resolved to a
   * pre-existing asset via checksum match rather than creating a new row
   * (AC-4.1's idempotent-upload contract). Absent (not `false`) on every
   * other read path - callers that don't upload never need to check it. */
  duplicate?: boolean;
}>;

export type MediaUsageDto = Readonly<{
  id: string;
  assetId: string;
  entityId: string | null;
  surface: string;
  field: string;
  locale: ContentLocale | null;
  altText: string | null;
  caption: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset?: MediaAssetDto;
}>;

export type MediaUsageReference = Readonly<{
  id: string;
  surface: string;
  field: string;
  locale: ContentLocale | null;
  entityId: string | null;
  entityContentType?: string | null;
}>;

export type MediaUsageReport = Readonly<{
  assetId: string;
  totalUsages: number;
  hasPublishedUsages: boolean;
  usages: readonly MediaUsageReference[];
}>;

export type StorageConfig = Readonly<{
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicBaseUrl?: string;
  isConfigured: boolean;
}>;

export type StorageUploadResult = Readonly<{
  objectKey: string;
  url: string;
}>;

export type PresignedUploadResult = Readonly<{
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
}>;

/** Client-facing ticket returned by `requestMediaUploadTicket` - everything
 * a browser needs to `PUT` bytes straight to storage without the file ever
 * passing through a server action's buffered body, plus the `objectKey` it
 * must send back to `finalizeMediaUpload`. Carries no storage credential. */
export type MediaUploadTicket = Readonly<{
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
}>;

export interface StorageProvider {
  upload(input: {
    objectKey: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StorageUploadResult>;
  delete(objectKey: string): Promise<boolean>;
  exists(objectKey: string): Promise<boolean>;
  /** Reads an object's full bytes back - the server-side half of a direct
   * upload's trust boundary: a client-side presigned `PUT` never runs
   * `validateUploadBuffer`, so `finalizeMediaUpload` downloads the object
   * here and validates the real bytes before any `MediaAsset` row exists. */
  download(objectKey: string): Promise<Buffer>;
  getPresignedUploadUrl(
    objectKey: string,
    mimeType: string,
    expiresInSeconds?: number
  ): Promise<PresignedUploadResult>;
  getPublicUrl(objectKey: string): string;
}

export type MediaSelectPayload = Readonly<{
  assetId: string;
  url: string;
  filename: string;
  mimeType: MediaMimeType;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
}>;

export type MediaPickerProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Single-select confirm - ignored when `multiple` is set. */
  onSelect?: (payload: MediaSelectPayload) => void;
  /** Renders checkbox multi-select instead of the single-asset detail
   * panel; confirming calls `onSelectMultiple` with every checked asset
   * (upload still adds and checks the new asset immediately). */
  multiple?: boolean;
  onSelectMultiple?: (payloads: readonly MediaSelectPayload[]) => void;
  allowedKinds?: readonly MediaKind[];
  currentAssetId?: string | null;
  activeLocale?: ContentLocale;
  /** Alt-text placeholder: the real content this image belongs to (site
   * brand for the hero, record title for a collection cover), not a slot
   * label - the admin sees exactly the text they would most likely type. */
  contextLabel?: string;
  /** Caption placeholder; falls back to `contextLabel` when omitted. */
  contextDescription?: string;
}>;

export type MediaFieldProps = Readonly<{
  /** When set, MediaField renders its own `<input type="hidden" name={name}>` so it drops into a native `<form>` (uncontrolled) without the parent tracking state. */
  name?: string;
  defaultValue?: string | null;
  defaultAssetId?: string | null;
  value?: string | null;
  assetId?: string | null;
  onChange?: (payload: { url: string; assetId?: string; altText?: string }) => void;
  label?: string;
  description?: string;
  allowedKinds?: readonly MediaKind[];
  activeLocale?: ContentLocale;
  /** Alt placeholder content; defaults to `label`. */
  contextLabel?: string;
  /** Caption placeholder content; defaults to `contextLabel`. */
  contextDescription?: string;
  /** Name of a sibling form field (e.g. `"title"`) whose current value wins
   * over `contextLabel` when the picker opens - lets uncontrolled editor
   * forms suggest the record's live title without lifting it into state. */
  contextFieldName?: string;
  disabled?: boolean;
}>;
