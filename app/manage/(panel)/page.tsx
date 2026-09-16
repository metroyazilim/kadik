import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { CmdRecentOperations } from "./CmdRecentOperations";
import { isAdminNavKey } from "@/components/admin/nav-items";
import {
  FAQ_CONTENT_TYPE,
  POST_CONTENT_TYPE,
  PRODUCT_CONTENT_TYPE,
  PROJECT_CONTENT_TYPE,
  SERVICE_CONTENT_TYPE,
  TEAM_MEMBER_CONTENT_TYPE,
} from "@/lib/content-model/payload-validation";

type SearchParams = Promise<{ panel?: string; item?: string }>;

const COLLECTIONS = [
  { contentType: SERVICE_CONTENT_TYPE, label: "Hizmetler", href: "/manage/services" },
  { contentType: PRODUCT_CONTENT_TYPE, label: "Ürünler", href: "/manage/products" },
  { contentType: PROJECT_CONTENT_TYPE, label: "Projeler", href: "/manage/projects" },
  { contentType: TEAM_MEMBER_CONTENT_TYPE, label: "Ekip", href: "/manage/team" },
  { contentType: FAQ_CONTENT_TYPE, label: "SSS", href: "/manage/faq" },
  { contentType: POST_CONTENT_TYPE, label: "Blog Yazıları", href: "/manage/posts" },
] as const;

const AUDIT_ACTION_LABEL: Record<string, string> = {
  login: "Giriş",
  logout: "Çıkış",
  create: "Oluşturma",
  update: "Güncelleme",
  publish: "Yayınlama",
  archive: "Arşivleme",
  delete: "Silme",
};

/**
 * `/manage` overview. Every figure is a `count()` - the dashboard never
 * loads content rows, so opening the panel costs a handful of index reads
 * regardless of how much content exists.
 *
 * Also absorbs the retired query-state addresses: `/manage?panel=services`
 * and `/manage?panel=services&item=<id>` redirect to the real routes so an
 * old bookmark still lands in the right place.
 */
export default async function ManageOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  if (query.panel && isAdminNavKey(query.panel) && query.panel !== "overview") {
    const item = query.item ? `/${encodeURIComponent(query.item)}` : "";
    redirect(`/manage/${query.panel}${item}`);
  }

  const [collectionCounts, publishedTranslations, draftTranslations, newMessages, mediaAssets, recentAudit] =
    await Promise.all([
      Promise.all(
        COLLECTIONS.map(async (collection) => ({
          ...collection,
          total: await prisma.contentEntity.count({ where: { contentType: collection.contentType } }),
        })),
      ),
      prisma.contentTranslation.count({ where: { publishedRevisionId: { not: null } } }),
      prisma.contentTranslation.count({ where: { publishedRevisionId: null, draftRevisionId: { not: null } } }),
      prisma.message.count({ where: { status: "UNREAD" } }),
      prisma.mediaAsset.count({ where: { archivedAt: null } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, action: true, entity: true, createdAt: true },
      }),
    ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Genel Bakış"
        title="Yönetim Paneli"
        description="İçerik durumunu, gelen mesajları ve son işlemleri buradan takip edin."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Yayında çeviri" value={publishedTranslations} hint="Public tarafta görünen" tone="success" />
        <StatCard label="Yayınlanmamış" value={draftTranslations} hint="Yayın bekleyen" tone="warning" />
        <StatCard
          label="Yeni mesaj"
          value={newMessages}
          hint="Okunmamış iletişim formu"
          tone={newMessages > 0 ? "accent" : "neutral"}
          href="/manage/messages"
        />
        <StatCard label="Medya" value={mediaAssets} hint="Arşivlenmemiş dosya" href="/manage/media" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold text-brand-text">Koleksiyonlar</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {collectionCounts.map((collection) => (
          <StatCard
            key={collection.contentType}
            label={collection.label}
            value={collection.total}
            hint="Kayıt"
            href={collection.href}
          />
        ))}
      </div>

      <CmdRecentOperations
        entries={recentAudit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          entity: entry.entity,
          time: entry.createdAt.toLocaleTimeString("tr-TR"),
        }))}
      />
    </div>
  );
}
