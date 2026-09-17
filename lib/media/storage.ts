import { createHash, createHmac } from "node:crypto";
import type {
  PresignedUploadResult,
  StorageConfig,
  StorageProvider,
  StorageUploadResult,
} from "./types";

export function getStorageConfig(): StorageConfig {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName =
    process.env.R2_BUCKET?.trim() || process.env.R2_BUCKET_NAME?.trim() || "metro-media";
  // Read the documented canonical names first; keeping the legacy aliases
  // prevents existing deployments from losing their public media URLs.
  const publicBaseUrl = (
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE ||
    process.env.R2_PUBLIC_URL ||
    process.env.MEDIA_BASE_URL ||
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    process.env.R2_CUSTOM_DOMAIN ||
    ""
  ).trim().replace(/\/+$/, "");

  const isConfigured = Boolean(
    accountId && accessKeyId && secretAccessKey && bucketName
  );

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    // Local/dev fallback (no R2 credentials, no explicit override): empty
    // base. `MemoryStorageProvider.getPublicUrl` always joins this with the
    // objectKey, and every objectKey this codebase generates already starts
    // with "uploads/" (see `generateObjectKey`) - a non-empty default like
    // "/uploads" here would double up into "/uploads/uploads/...".
    publicBaseUrl: publicBaseUrl || (accountId ? `https://pub-${accountId.slice(0, 8)}.r2.dev` : ""),
    isConfigured,
  };
}

/**
 * Pure TypeScript AWS SigV4 signer for S3-compatible APIs (Cloudflare R2, MinIO, AWS S3).
 * Zero heavy SDK dependencies, safe against bundle size & secret leakage.
 */
class AwsSigV4 {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private readonly service: string;

  constructor(accessKeyId: string, secretAccessKey: string, region = "auto", service = "s3") {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
    this.service = service;
  }

  private hmac(key: Buffer | string, data: string): Buffer {
    return createHmac("sha256", key).update(data, "utf8").digest();
  }

  private hash(data: Buffer | string): string {
    return createHash("sha256").update(data).digest("hex");
  }

  getSignatureKey(dateStamp: string): Buffer {
    const kDate = this.hmac("AWS4" + this.secretAccessKey, dateStamp);
    const kRegion = this.hmac(kDate, this.region);
    const kService = this.hmac(kRegion, this.service);
    return this.hmac(kService, "aws4_request");
  }

  signHeaders(options: {
    method: string;
    url: URL;
    headers: Record<string, string>;
    payloadHash: string;
    datetime: string;
  }): Record<string, string> {
    const { method, url, headers, payloadHash, datetime } = options;
    const dateStamp = datetime.slice(0, 8);

    const canonicalHeaders: Record<string, string> = {
      ...headers,
      host: url.host,
      "x-amz-date": datetime,
      "x-amz-content-sha256": payloadHash,
    };

    const headerKeys = Object.keys(canonicalHeaders).sort();
    const canonicalHeadersStr = headerKeys
      .map((key) => `${key.toLowerCase()}:${canonicalHeaders[key].trim()}\n`)
      .join("");
    const signedHeaders = headerKeys.map((key) => key.toLowerCase()).join(";");

    const canonicalRequest = [
      method,
      url.pathname,
      url.search.slice(1),
      canonicalHeadersStr,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      datetime,
      credentialScope,
      this.hash(canonicalRequest),
    ].join("\n");

    const signingKey = this.getSignatureKey(dateStamp);
    const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...canonicalHeaders,
      Authorization: authorization,
    };
  }

  generatePresignedUrl(options: {
    method: string;
    url: URL;
    expiresInSeconds: number;
    datetime: string;
  }): string {
    const { method, url, expiresInSeconds, datetime } = options;
    const dateStamp = datetime.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;

    url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    url.searchParams.set("X-Amz-Credential", `${this.accessKeyId}/${credentialScope}`);
    url.searchParams.set("X-Amz-Date", datetime);
    url.searchParams.set("X-Amz-Expires", expiresInSeconds.toString());
    url.searchParams.set("X-Amz-SignedHeaders", "host");

    const canonicalHeadersStr = `host:${url.host}\n`;
    const signedHeaders = "host";

    const canonicalRequest = [
      method,
      url.pathname,
      url.search.slice(1),
      canonicalHeadersStr,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      datetime,
      credentialScope,
      this.hash(canonicalRequest),
    ].join("\n");

    const signingKey = this.getSignatureKey(dateStamp);
    const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    url.searchParams.set("X-Amz-Signature", signature);
    return url.toString();
  }
}

/**
 * Cloudflare R2 object storage provider.
 */
export class R2StorageProvider implements StorageProvider {
  private readonly config: StorageConfig;
  private readonly signer: AwsSigV4;
  private readonly endpoint: string;

  constructor(config: StorageConfig) {
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      throw new Error("R2StorageProvider requires accountId, accessKeyId, secretAccessKey, and bucketName");
    }
    this.config = config;
    this.endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    this.signer = new AwsSigV4(config.accessKeyId, config.secretAccessKey, "auto", "s3");
  }

  getPublicUrl(objectKey: string): string {
    const cleanKey = objectKey.replace(/^\/+/, "");
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl}/${cleanKey}`;
    }
    return `https://${this.config.bucketName}.${this.config.accountId}.r2.cloudflarestorage.com/${cleanKey}`;
  }

  async upload(input: {
    objectKey: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StorageUploadResult> {
    const cleanKey = input.objectKey.replace(/^\/+/, "");
    const url = new URL(`/${this.config.bucketName}/${cleanKey}`, this.endpoint);
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const payloadHash = createHash("sha256").update(input.buffer).digest("hex");

    const headers = this.signer.signHeaders({
      method: "PUT",
      url,
      headers: {
        "content-type": input.mimeType,
        "content-length": input.buffer.length.toString(),
      },
      payloadHash,
      datetime,
    });

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers,
      body: new Uint8Array(input.buffer),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`R2 upload failed with HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }

    return {
      objectKey: cleanKey,
      url: this.getPublicUrl(cleanKey),
    };
  }

  async delete(objectKey: string): Promise<boolean> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    const url = new URL(`/${this.config.bucketName}/${cleanKey}`, this.endpoint);
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const payloadHash = createHash("sha256").update("").digest("hex");

    const headers = this.signer.signHeaders({
      method: "DELETE",
      url,
      headers: {},
      payloadHash,
      datetime,
    });

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers,
    });

    return response.ok || response.status === 404;
  }

  async exists(objectKey: string): Promise<boolean> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    const url = new URL(`/${this.config.bucketName}/${cleanKey}`, this.endpoint);
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const payloadHash = createHash("sha256").update("").digest("hex");

    const headers = this.signer.signHeaders({
      method: "HEAD",
      url,
      headers: {},
      payloadHash,
      datetime,
    });

    try {
      const response = await fetch(url.toString(), {
        method: "HEAD",
        headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Downloads an object's full bytes. The server-side half of the direct-
   * upload trust boundary: a client `PUT` against a presigned URL never
   * runs `validateUploadBuffer` (the server never sees the bytes in
   * transit), so `finalizeMediaUpload` calls this to fetch them back and
   * validate for real before any `MediaAsset` row is created.
   */
  async download(objectKey: string): Promise<Buffer> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    const url = new URL(`/${this.config.bucketName}/${cleanKey}`, this.endpoint);
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const payloadHash = createHash("sha256").update("").digest("hex");

    const headers = this.signer.signHeaders({
      method: "GET",
      url,
      headers: {},
      payloadHash,
      datetime,
    });

    const response = await fetch(url.toString(), { method: "GET", headers });
    if (!response.ok) {
      throw new Error(`R2 download failed with HTTP ${response.status} for object '${cleanKey}'.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async getPresignedUploadUrl(
    objectKey: string,
    mimeType: string,
    expiresInSeconds = 900
  ): Promise<PresignedUploadResult> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    const url = new URL(`/${this.config.bucketName}/${cleanKey}`, this.endpoint);
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, "");

    const uploadUrl = this.signer.generatePresignedUrl({
      method: "PUT",
      url,
      expiresInSeconds,
      datetime,
    });

    return {
      uploadUrl,
      publicUrl: this.getPublicUrl(cleanKey),
      objectKey: cleanKey,
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
      },
      expiresInSeconds,
    };
  }
}

/**
 * Memory storage provider for tests and development without Cloudflare R2 credentials.
 */
export class MemoryStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, { buffer: Buffer; mimeType: string }>();
  private readonly publicBaseUrl: string;

  constructor(publicBaseUrl = "") {
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  }

  getPublicUrl(objectKey: string): string {
    const cleanKey = objectKey.replace(/^\/+/, "");
    return `${this.publicBaseUrl}/${cleanKey}`;
  }

  async upload(input: {
    objectKey: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StorageUploadResult> {
    const cleanKey = input.objectKey.replace(/^\/+/, "");
    this.objects.set(cleanKey, {
      buffer: Buffer.from(input.buffer),
      mimeType: input.mimeType,
    });
    return {
      objectKey: cleanKey,
      url: this.getPublicUrl(cleanKey),
    };
  }

  async delete(objectKey: string): Promise<boolean> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    return this.objects.delete(cleanKey);
  }

  async exists(objectKey: string): Promise<boolean> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    return this.objects.has(cleanKey);
  }

  async download(objectKey: string): Promise<Buffer> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    const entry = this.objects.get(cleanKey);
    if (!entry) {
      throw new Error(`MemoryStorageProvider has no object for key '${cleanKey}'.`);
    }
    return Buffer.from(entry.buffer);
  }

  async getPresignedUploadUrl(
    objectKey: string,
    mimeType: string,
    expiresInSeconds = 900
  ): Promise<PresignedUploadResult> {
    const cleanKey = objectKey.replace(/^\/+/, "");
    return {
      uploadUrl: `/api/manage/media/mock-upload?key=${encodeURIComponent(cleanKey)}`,
      publicUrl: this.getPublicUrl(cleanKey),
      objectKey: cleanKey,
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
      },
      expiresInSeconds,
    };
  }

  getBuffer(objectKey: string): Buffer | null {
    const cleanKey = objectKey.replace(/^\/+/, "");
    return this.objects.get(cleanKey)?.buffer || null;
  }

  clear(): void {
    this.objects.clear();
  }
}

// `globalThis`-attached, not a plain module-level variable - the same
// pattern `lib/db.ts` uses for its Prisma client. Next.js's dev bundler
// (Turbopack) re-evaluates a route/action's module graph independently per
// request in dev mode; a plain `let` here silently resets between the
// direct-upload ticket request, the mock-upload `PUT`, and the finalize
// action, so `MemoryStorageProvider`'s in-memory object map would never
// see the same instance twice and every direct upload would 404 against
// its own just-written object. `globalThis` is the one thing Next.js dev
// guarantees survives across those module re-evaluations in a single
// process.
const globalForStorage = globalThis as unknown as { metroStorageProvider?: StorageProvider };

export function getStorageProvider(overrideConfig?: StorageConfig): StorageProvider {
  if (overrideConfig) {
    if (overrideConfig.isConfigured) {
      return new R2StorageProvider(overrideConfig);
    }
    return new MemoryStorageProvider(overrideConfig.publicBaseUrl);
  }

  if (globalForStorage.metroStorageProvider) {
    return globalForStorage.metroStorageProvider;
  }

  const config = getStorageConfig();
  globalForStorage.metroStorageProvider = config.isConfigured
    ? new R2StorageProvider(config)
    : new MemoryStorageProvider(config.publicBaseUrl);

  return globalForStorage.metroStorageProvider;
}

export function setStorageProviderForTesting(provider: StorageProvider | null): void {
  if (provider) {
    globalForStorage.metroStorageProvider = provider;
  } else {
    delete globalForStorage.metroStorageProvider;
  }
}
