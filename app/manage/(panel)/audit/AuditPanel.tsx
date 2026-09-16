import Link from "next/link";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { ToneBadge } from "@/components/admin/StatusBadge";
import { secondaryButton, tableCell, tableHeadCell, tableHeadRow, tableRow, tableWrap } from "@/components/admin/ui";
import { prisma } from "@/lib/db";

const AUDIT_PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, string> = {
  create: "Oluşturuldu",
  update: "Güncellendi",
  delete: "Silindi",
  login: "Giriş",
  logout: "Çıkış",
  "content.archive": "Arşivlendi",
  "content.unarchive": "Arşivden çıkarıldı",
  "content.hardDelete": "Kalıcı silindi",
  "message.status.changed": "Durum değiştirildi",
};

const ENTITY_LABELS: Record<string, string> = {
  session: "Oturum",
  content: "Site içeriği",
  "site-content": "Site içeriği",
  ContentEntity: "İçerik kaydı",
  post: "Blog yazısı",
  service: "Hizmet",
  product: "Ürün",
  project: "Proje",
  "team-member": "Ekip üyesi",
  faq: "SSS",
  message: "Mesaj",
  Message: "Mesaj",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "medium" });

function actionTone(action: string): "success" | "danger" | "primary" | "muted" {
  if (action === "delete" || action === "content.hardDelete") return "danger";
  if (action === "create" || action === "login") return "success";
  if (action === "logout") return "muted";
  return "primary";
}

/**
 * Metadata is admin-authored context, not a safe display surface: values can
 * carry slugs, payload fragments or e-mail addresses. Only the recorded key
 * names are shown - enough to know *what* was captured without rendering
 * arbitrary content into the terminal.
 */
function metadataKeys(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "—";
  const keys = Object.keys(metadata);
  return keys.length === 0 ? "—" : keys.sort().join(", ");
}

export type AuditDirection = "older" | "newer";

/**
 * Cursor-paged audit terminal (Spec 13). Rows always render newest-first.
 *
 * - `older`: rows strictly after the cursor in newest-first order - read
 *   directly with `orderBy: desc`.
 * - `newer`: rows strictly before it - read with `orderBy: asc` (so the
 *   cursor window walks backwards) and reversed for display.
 *
 * `take: PAGE_SIZE + 1` is a lookahead: the extra row only answers "is there
 * another page in this direction", it is never rendered.
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
  const entries = walkingBackwards ? [...window].reverse() : window;

  const newestId = entries[0]?.id;
  const oldestId = entries[entries.length - 1]?.id;
  // Walking forward, a previous page exists whenever a cursor was supplied;
  // walking backwards, the lookahead answers it for the newer direction.
  const hasNewer = walkingBackwards ? hasMoreInDirection : Boolean(cursor);
  const hasOlder = walkingBackwards ? true : hasMoreInDirection;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          Cursor tabanlı geçmiş: sayfa numarası yok, kayıt eklenirken sayfa kayması olmaz.
        </p>
        <div className="flex gap-2">
          {hasNewer && newestId ? (
            <Link href={`/manage/audit?cursor=${newestId}&direction=newer`} className={secondaryButton}>
              ↑ Daha yeni
            </Link>
          ) : null}
          {hasOlder && oldestId ? (
            <Link href={`/manage/audit?cursor=${oldestId}&direction=older`} className={secondaryButton}>
              ↓ Daha eski
            </Link>
          ) : null}
          {cursor ? (
            <Link href="/manage/audit" className={secondaryButton}>
              En başa dön
            </Link>
          ) : null}
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="Kayıt yok" description="Bu pencerede denetim kaydı bulunmuyor." />
      ) : (
        <div className={tableWrap}>
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className={tableHeadRow}>
                <th className={tableHeadCell}>İşlem</th>
                <th className={tableHeadCell}>Varlık</th>
                <th className={tableHeadCell}>Kayıt</th>
                <th className={tableHeadCell}>Yapan</th>
                <th className={tableHeadCell}>Zaman</th>
                <th className={tableHeadCell}>Metadata alanları</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className={tableRow}>
                  <td className={tableCell}>
                    <ToneBadge tone={actionTone(entry.action)} label={ACTION_LABELS[entry.action] ?? entry.action} />
                  </td>
                  <td className={tableCell}>{ENTITY_LABELS[entry.entity] ?? entry.entity}</td>
                  <td className={`${tableCell} font-mono text-xs text-brand-muted`}>{entry.entityId ?? "—"}</td>
                  <td className={tableCell}>{entry.user?.email ?? "—"}</td>
                  <td className={`${tableCell} whitespace-nowrap text-brand-muted`}>{dateFormatter.format(entry.createdAt)}</td>
                  <td className={`${tableCell} font-mono text-[11px] text-brand-muted`}>{metadataKeys(entry.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
