import { prisma } from "@/lib/db";
import { KADIK_PAGE_DEFINITIONS, isKadikContentKey } from "@/lib/kadik-content/pages";
import { AuditTerminal, type AuditTerminalLine } from "./AuditTerminal";

const AUDIT_PAGE_SIZE = 100;

/** Plain-language description per action code; unknown codes show the code only. */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  login: "panele giriş yaptı",
  logout: "panelden çıkış yaptı",
  create: "kayıt oluşturdu",
  update: "kayıt güncelledi",
  delete: "kayıt sildi",
  "content.draft.save": "içerik kaydetti",
  "content.publish": "içerik yayınladı",
  "content.archive": "içerik arşivledi",
  "content.unarchive": "içeriği arşivden çıkardı",
  "content.hardDelete": "içeriği kalıcı sildi",
  "kadik.page.publish": "sayfayı kaydedip yayınladı",
  "media.upload": "medya yükledi",
  "media.updateMetadata": "medya bilgilerini güncelledi",
  "media.archive": "medyayı arşivledi",
  "media.delete": "medyayı sildi",
  "media.replaceUsage": "medyayı değiştirdi",
  "message.status.changed": "mesaj durumunu değiştirdi",
  "page.copy.publish": "sayfa metni yayınladı",
};

const ENTITY_LABELS: Record<string, string> = {
  session: "oturum",
  ContentTranslation: "içerik",
  ContentEntity: "içerik kaydı",
  KadikPageContent: "sayfa",
  MediaAsset: "medya",
  Message: "mesaj",
  message: "mesaj",
  AdminUser: "kullanıcı",
};

function tone(action: string): AuditTerminalLine["tone"] {
  if (action.includes("delete") || action.includes("hardDelete")) return "danger";
  if (action === "login" || action.includes("publish") || action.includes("upload")) return "success";
  if (action === "logout") return "muted";
  return "info";
}

const TIME_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** `YYYY-MM-DD HH:mm:ss` in Istanbul time. */
function formatTime(date: Date): string {
  const part = Object.fromEntries(TIME_PARTS.formatToParts(date).map((entry) => [entry.type, entry.value]));
  return `${part.year}-${part.month}-${part.day} ${part.hour}:${part.minute}:${part.second}`;
}

function target(entity: string, entityId: string | null): string {
  if (entity === "session") return "";
  if (entity === "KadikPageContent" && entityId && isKadikContentKey(entityId)) return `sayfa:${KADIK_PAGE_DEFINITIONS[entityId].label}`;
  const label = ENTITY_LABELS[entity] ?? entity;
  return entityId ? `${label}#${entityId.slice(-8)}` : label;
}

/**
 * Metadata is admin-authored context, not a safe display surface: values can
 * carry slugs, payload fragments or e-mail addresses. Only numbers, booleans
 * and short status/locale codes are printed; ids and free text are left out.
 */
function details(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  return Object.entries(metadata as Record<string, unknown>)
    .filter(([key, value]) =>
      !/id$/i.test(key) &&
      (typeof value === "number" || typeof value === "boolean" || (typeof value === "string" && /^[a-z_]{2,16}$/i.test(value))),
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

export type AuditDirection = "older" | "newer";

/**
 * Cursor-paged audit log (Spec 13), rendered as a terminal. The database is
 * read newest-first; the terminal prints the window oldest-first so the most
 * recent line sits at the bottom like `tail -f`.
 *
 * - `older`: rows strictly after the cursor in newest-first order.
 * - `newer`: rows strictly before it - read ascending, then flipped.
 *
 * `take: PAGE_SIZE + 1` is a lookahead that only answers "is there another
 * window in this direction"; it is never rendered.
 */
export async function AuditPanel({ cursor, direction = "older" }: { cursor?: string; direction?: AuditDirection }) {
  const walkingBackwards = direction === "newer" && Boolean(cursor);

  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: walkingBackwards ? "asc" : "desc" },
    take: AUDIT_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  const hasMoreInDirection = rows.length > AUDIT_PAGE_SIZE;
  const window = rows.slice(0, AUDIT_PAGE_SIZE);
  const newestFirst = walkingBackwards ? [...window].reverse() : window;

  const newestId = newestFirst[0]?.id;
  const oldestId = newestFirst[newestFirst.length - 1]?.id;
  const hasNewer = walkingBackwards ? hasMoreInDirection : Boolean(cursor);
  const hasOlder = walkingBackwards ? true : hasMoreInDirection;

  const lines: AuditTerminalLine[] = [...newestFirst].reverse().map((entry) => ({
    id: entry.id,
    time: formatTime(entry.createdAt),
    actor: entry.user?.email ?? "sistem",
    action: entry.action.toUpperCase().replace(/\./g, "_"),
    description: ACTION_DESCRIPTIONS[entry.action] ?? "",
    target: target(entry.entity, entry.entityId),
    details: details(entry.metadata),
    tone: tone(entry.action),
  }));

  return (
    <AuditTerminal
      lines={lines}
      olderHref={hasOlder && oldestId ? `/manage/audit?cursor=${oldestId}&direction=older` : null}
      newerHref={hasNewer && newestId ? `/manage/audit?cursor=${newestId}&direction=newer` : null}
      resetHref={cursor ? "/manage/audit" : null}
    />
  );
}
