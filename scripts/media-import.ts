/*
 * Tek dosya:
 *   npx tsx scripts/media-import.ts --source ./photo.jpg --name kurul-uyesi --alt "Kurul üyesi"
 *
 * URL'den tek dosya:
 *   npx tsx scripts/media-import.ts --source https://example.com/photo.jpg --name kurul-uyesi
 *
 * Kurul üyesi fotoğrafları gibi bir klasördeki tüm görseller:
 *   npx tsx scripts/media-import.ts --dir ./kurul-uyeleri --max-width 1600 --quality 85
 */

import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import type { AdminContext } from "@/lib/content-model/admin-context";
import { issueScriptAdminContext } from "@/lib/content-model/admin-context-script-support";
import { prisma } from "@/lib/db";
import { createMediaAsset } from "@/lib/media/service";
import { sanitizeFilename, validateUploadBuffer } from "@/lib/media/validation";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supportedExtensions: Record<string, true> = {
  ".jpg": true,
  ".jpeg": true,
  ".png": true,
  ".webp": true,
};

export async function scriptAdminContext(): Promise<AdminContext> {
  nextEnv.loadEnvConfig(projectRoot, true);

  const admin = await prisma.adminUser.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  if (!admin) {
    throw new Error(
      "Medya içe aktarma için veritabanında bir SUPER_ADMIN hesabı bulunamadı.",
    );
  }

  return issueScriptAdminContext(admin);
}

async function readSource(source: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Görsel indirilemedi: HTTP ${response.status} (${source})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(resolve(source));
}

async function cwebpExecutable(): Promise<string> {
  const configured = process.env.KADIK_CWEBP?.trim();
  if (configured) return configured;

  const homebrewPath = "/opt/homebrew/bin/cwebp";
  try {
    await access(homebrewPath, constants.X_OK);
    return homebrewPath;
  } catch {
    return "cwebp";
  }
}

function outputFilename(filename: string): string {
  const withoutImageExtension = filename.replace(/\.(?:jpe?g|png|webp)$/i, "");
  return `${sanitizeFilename(withoutImageExtension)}.webp`;
}

function normalizedQuality(quality: number | undefined): number {
  const value = quality ?? 85;
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("quality 0 ile 100 arasında bir tam sayı olmalıdır.");
  }
  return value;
}

function normalizedMaxWidth(maxWidth: number | undefined): number | undefined {
  if (maxWidth === undefined) return undefined;
  if (!Number.isInteger(maxWidth) || maxWidth <= 0) {
    throw new Error("maxWidth pozitif bir tam sayı olmalıdır.");
  }
  return maxWidth;
}

export async function importImageAsset(input: {
  source: string;
  filename: string;
  altText?: string;
  caption?: string;
  maxWidth?: number;
  quality?: number;
  context?: AdminContext;
}): Promise<{
  assetId: string;
  url: string;
  objectKey: string;
  duplicate: boolean;
  width: number | null;
  height: number | null;
}> {
  const quality = normalizedQuality(input.quality);
  const maxWidth = normalizedMaxWidth(input.maxWidth);
  const filename = outputFilename(input.filename);
  const context = input.context ?? (await scriptAdminContext());
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "kadik-media-import-"));
  const sourceExtension = (
    /^https?:\/\//i.test(input.source)
      ? extname(new URL(input.source).pathname)
      : extname(input.source)
  ).toLowerCase();
  const temporaryInput = join(
    temporaryDirectory,
    `source${supportedExtensions[sourceExtension] ? sourceExtension : ".input"}`,
  );
  const temporaryOutput = join(temporaryDirectory, filename);

  try {
    await writeFile(temporaryInput, await readSource(input.source));

    const arguments_ = ["-q", String(quality)];
    if (maxWidth !== undefined) arguments_.push("-resize", String(maxWidth), "0");
    arguments_.push(temporaryInput, "-o", temporaryOutput);

    await execFileAsync(await cwebpExecutable(), arguments_);

    const buffer = await readFile(temporaryOutput);
    const validated = validateUploadBuffer(buffer, filename, "image/webp");
    const asset = await createMediaAsset(prisma, validated, context, {
      altText: input.altText,
      caption: input.caption,
    });

    return {
      assetId: asset.id,
      url: asset.url,
      objectKey: asset.objectKey,
      duplicate: asset.duplicate === true,
      width: asset.width,
      height: asset.height,
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

type CliOptions = {
  source?: string;
  name?: string;
  directory?: string;
  altText?: string;
  caption?: string;
  maxWidth?: number;
  quality?: number;
};

function parseNumberFlag(flag: string, value: string | undefined): number {
  if (value === undefined) throw new Error(`${flag} için bir değer gerekli.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${flag} sayısal olmalıdır.`);
  return parsed;
}

function parseCliArguments(arguments_: readonly string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < arguments_.length; index += 1) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];

    switch (flag) {
      case "--source":
        if (value === undefined) throw new Error("--source için bir değer gerekli.");
        options.source = value;
        index += 1;
        break;
      case "--name":
        if (value === undefined) throw new Error("--name için bir değer gerekli.");
        options.name = value;
        index += 1;
        break;
      case "--dir":
        if (value === undefined) throw new Error("--dir için bir değer gerekli.");
        options.directory = value;
        index += 1;
        break;
      case "--alt":
        if (value === undefined) throw new Error("--alt için bir değer gerekli.");
        options.altText = value;
        index += 1;
        break;
      case "--caption":
        if (value === undefined) throw new Error("--caption için bir değer gerekli.");
        options.caption = value;
        index += 1;
        break;
      case "--max-width":
        options.maxWidth = parseNumberFlag(flag, value);
        index += 1;
        break;
      case "--quality":
        options.quality = parseNumberFlag(flag, value);
        index += 1;
        break;
      default:
        throw new Error(`Bilinmeyen seçenek: ${flag}`);
    }
  }

  return options;
}

function printImportedAsset(
  label: string,
  result: {
    assetId: string;
    url: string;
    duplicate: boolean;
  },
): void {
  console.log(
    `${label} -> ${result.assetId} -> ${result.url} (duplicate: ${result.duplicate})`,
  );
}

async function runCli(): Promise<void> {
  const options = parseCliArguments(process.argv.slice(2));
  if (Boolean(options.source) === Boolean(options.directory)) {
    throw new Error("Tam olarak bir kaynak belirtin: --source veya --dir.");
  }

  const context = await scriptAdminContext();

  if (options.source) {
    if (!options.name) throw new Error("--source kullanırken --name zorunludur.");
    const result = await importImageAsset({
      source: options.source,
      filename: options.name,
      altText: options.altText,
      caption: options.caption,
      maxWidth: options.maxWidth,
      quality: options.quality,
      context,
    });
    printImportedAsset(options.name, result);
    return;
  }

  const directory = resolve(options.directory!);
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() && supportedExtensions[extname(entry.name).toLowerCase()],
    )
    .sort((left, right) => left.name.localeCompare(right.name, "tr"));

  if (entries.length === 0) {
    throw new Error(`Desteklenen görsel bulunamadı: ${directory}`);
  }

  for (const entry of entries) {
    const result = await importImageAsset({
      source: join(directory, entry.name),
      filename: parse(entry.name).name,
      altText: options.altText,
      caption: options.caption,
      maxWidth: options.maxWidth,
      quality: options.quality,
      context,
    });
    printImportedAsset(entry.name, result);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
