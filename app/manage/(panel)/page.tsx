import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { InfoCard } from "@/components/admin/InfoCard";
import { StatCard } from "@/components/admin/StatCard";
import { CmdRecentOperations } from "./CmdRecentOperations";
import { isAdminNavKey } from "@/components/admin/nav-items";
import { secondaryButton } from "@/components/admin/ui";
import { POST_CONTENT_TYPE, TEAM_MEMBER_CONTENT_TYPE } from "@/lib/content-model/payload-validation";
import { ADMIN_CONTENT_LOCALE } from "@/lib/i18n/config";
import { KADIK_CONTENT_KEYS } from "@/lib/kadik-content/pages";

type SearchParams = Promise<{ panel?: string; item?: string }>;

const COLLECTIONS = [
  { contentType: TEAM_MEMBER_CONTENT_TYPE, label: "Kurul Üyeleri", href: "/manage/team" },
  { contentType: POST_CONTENT_TYPE, label: "Yayınlar ve Haberler", href: "/manage/posts" },
] as const;

const SITE_SHORTCUTS = [
  { label: "Anasayfa", href: "/" },
  { label: "Kurul Üyeleri", href: "/board" },
  { label: "Haberler", href: "/news" },
  { label: "Etkinlikler", href: "/events" },
  { label: "Duyurular", href: "/announcements" },
  { label: "Üyelik", href: "/membership" },
  { label: "Galeri", href: "/gallery" },
  { label: "İletişim", href: "/contact" },
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

  const [collectionCounts, publishedRecords, draftRecords, newMessages, mediaAssets, recentAudit] =
    await Promise.all([
      Promise.all(
        COLLECTIONS.map(async (collection) => ({
          ...collection,
          total: await prisma.contentEntity.count({ where: { contentType: collection.contentType, archived: false } }),
        })),
      ),
      prisma.contentTranslation.count({
        where: { locale: ADMIN_CONTENT_LOCALE, publishedRevisionId: { not: null }, entity: { contentType: { in: COLLECTIONS.map((c) => c.contentType) }, archived: false } },
      }),
      prisma.contentTranslation.count({
        where: { locale: ADMIN_CONTENT_LOCALE, publishedRevisionId: null, draftRevisionId: { not: null }, entity: { contentType: { in: COLLECTIONS.map((c) => c.contentType) }, archived: false } },
      }),
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
        <StatCard label="Yayındaki kayıt" value={publishedRecords} hint="Kurul üyesi ve haber" tone="success" />
        <StatCard label="Yayında olmayan" value={draftRecords} hint="Kaydedilip yayınlanmamış" tone="warning" />
        <StatCard
          label="Yeni mesaj"
          value={newMessages}
          hint="Okunmamış iletişim formu"
          tone={newMessages > 0 ? "accent" : "neutral"}
          href="/manage/messages"
        />
        <StatCard label="Medya" value={mediaAssets} hint="Arşivlenmemiş dosya" href="/manage/media" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold text-brand-text">İçerik</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Sayfalar" value={KADIK_CONTENT_KEYS.length} hint="Düzenlenebilir sayfa" href="/manage/pages" />
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

      <InfoCard
        title="KADİK sitesi kısayolları"
        description="Sitedeki temel sayfaları yeni sekmede görüntüleyin."
        className="mt-8"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SITE_SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${shortcut.label} sayfasını yeni sekmede aç`}
              className={secondaryButton}
            >
              {shortcut.label}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </InfoCard>

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
