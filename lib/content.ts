import "server-only";
import { DICTIONARIES } from "./i18n/dictionaries";
import { isLocale, type Locale } from "./i18n/config";
import type { Dictionary } from "./i18n/types";
import { hasDatabase } from "./env";
import { prisma } from "./db";
import type { MessageStatus, Prisma } from "@prisma/client";
import { createMessageSubmission } from "./content-model/message-submission";

function mergeDictionary(base: Dictionary, override: unknown): Dictionary {
  const merge = (left: unknown, right: unknown): unknown => {
    if (
      typeof left !== "object" || left === null || Array.isArray(left) ||
      typeof right !== "object" || right === null || Array.isArray(right)
    ) return right ?? left;
    const result = { ...(left as Record<string, unknown>) };
    for (const [key, value] of Object.entries(right as Record<string, unknown>)) result[key] = merge(result[key], value);
    return result;
  };
  return merge(base, override) as Dictionary;
}

async function findDictionary(locale: Locale) {
  switch (locale) {
    case "tr": return prisma.siteContentTr.findUnique({ where: { key: "dictionary" }, select: { value: true, published: true } });
    case "en": return prisma.siteContentEn.findUnique({ where: { key: "dictionary" }, select: { value: true, published: true } });
  }
}

export async function getAdminDictionary(locale: Locale): Promise<Dictionary> {
  if (!hasDatabase()) return DICTIONARIES[locale];
  const record = await findDictionary(locale);
  return mergeDictionary(DICTIONARIES[locale], record?.value);
}

export async function saveAdminDictionary(
  locale: Locale,
  dictionary: Dictionary,
): Promise<void> {
  const data = {
    value: dictionary as unknown as Prisma.InputJsonValue,
    published: true,
  };
  switch (locale) {
    case "tr":
      await prisma.siteContentTr.upsert({
        where: { key: "dictionary" },
        update: data,
        create: { key: "dictionary", ...data },
      });
      return;
    case "en":
      await prisma.siteContentEn.upsert({
        where: { key: "dictionary" },
        update: data,
        create: { key: "dictionary", ...data },
      });
      return;
}
}

export async function getPublicDictionary(locale: Locale): Promise<Dictionary> {
  if (!hasDatabase()) return DICTIONARIES[locale];
  try {
    const record = await findDictionary(locale);
    return record?.published ? mergeDictionary(DICTIONARIES[locale], record.value) : DICTIONARIES[locale];
  } catch (error) {
    console.error("Metro Yazılım content read failed; using checked-in dictionary", error);
    return DICTIONARIES[locale];
  }
}

export function validLocale(value: string): value is Locale {
  return isLocale(value);
}

export { LOCALES } from "./i18n/config";

// ---- Mesajlar (contact form submissions) ----
//
// Deliberately not a ContentEntity/ContentTranslation type - visitor input
// is not locale-translatable managed content (see the `Message` model's
// own schema comment). Admin status mutation lives in
// `content-model/message-store.ts` (AdminContext-gated, audited,
// optimistic-concurrency CAS); this section only covers the public write
// (idempotent create) and the admin's paginated/filtered read.

export type ManagedMessage = {
  id: string;
  locale: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: MessageStatus;
  version: number;
  createdAt: Date;
};
export type MessageInput = Omit<ManagedMessage, "id" | "status" | "version" | "createdAt">;

export const MESSAGE_PAGE_SIZE = 20;
export const CONTACT_RATE_LIMIT_SCOPE = "contact-message";
export const CONTACT_RATE_LIMIT_WINDOW_MS = 60_000;
export const CONTACT_RATE_LIMIT_MAX_SUBMISSIONS = 5;

/** Thin delegate to the client-injectable, integration-tested core (Story 6.3 CAP-2). */
export async function createMessage(data: MessageInput): Promise<ManagedMessage> {
  return createMessageSubmission(prisma, data);
}

export type MessageStatusFilter = MessageStatus | "ALL";
export type MessageListPage = {
  messages: ManagedMessage[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getMessages(options: { status?: MessageStatusFilter; page?: number } = {}): Promise<MessageListPage> {
  if (!hasDatabase()) return { messages: [], total: 0, page: 1, pageSize: MESSAGE_PAGE_SIZE };
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const where = options.status && options.status !== "ALL" ? { status: options.status } : undefined;
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * MESSAGE_PAGE_SIZE,
      take: MESSAGE_PAGE_SIZE,
    }),
    prisma.message.count({ where }),
  ]);
  return { messages, total, page, pageSize: MESSAGE_PAGE_SIZE };
}

export async function getMessage(id: string): Promise<ManagedMessage | null> {
  if (!hasDatabase()) return null;
  return prisma.message.findUnique({ where: { id } });
}
