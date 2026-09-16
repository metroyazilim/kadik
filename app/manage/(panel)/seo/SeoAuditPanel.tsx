import type { ContentLocale } from "@prisma/client";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { ToneBadge } from "@/components/admin/StatusBadge";
import { tableCell, tableHeadCell, tableHeadRow, tableRow, tableWrap } from "@/components/admin/ui";
import { prisma } from "@/lib/db";
import { LOCALES } from "@/lib/i18n/config";
import { getAllPublishedRoutesForSitemap } from "@/lib/content-model/route-reader";
import {
  runSeoAudit,
  type ContentSeoPayload,
  type SeoAuditCategory,
  type SeoAuditFinding,
  type SitemapRouteRow,
} from "@/lib/content-model/public-seo";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import {
  SERVICE_CONTENT_TYPE,
  PRODUCT_CONTENT_TYPE,
  PROJECT_CONTENT_TYPE,
  TEAM_MEMBER_CONTENT_TYPE,
  POST_CONTENT_TYPE,
} from "@/lib/content-model/payload-validation";
import { generateRoute } from "@/lib/content-model/route-registry";
import { getPublicSiteSettings } from "@/lib/public-content/site-settings";
import { getPublishedServiceByRoute } from "@/lib/public-content/service";
import { getPublishedProductByRoute } from "@/lib/public-content/product";
import { getPublishedProjectByRoute } from "@/lib/public-content/project";
import { getPublishedTeamMemberByRoute } from "@/lib/public-content/team";
import { descriptionOf } from "@/lib/public-pages/team-member-detail";
import { getPublishedPostByRoute } from "@/lib/public-content/post";

/** Content types with their own always-listing collection page
 * (app/servisler|urunler|projeler|blog) - every published entity of these
 * types is trivially reachable regardless of nav/footer configuration.
 * Team has no such collection page today, so a team member's reachability
 * depends entirely on the real published navigation/footer. */
const COLLECTION_LISTED_CONTENT_TYPES: ReadonlySet<string> = new Set([
  SERVICE_CONTENT_TYPE,
  PRODUCT_CONTENT_TYPE,
  PROJECT_CONTENT_TYPE,
  POST_CONTENT_TYPE,
]);

const CATEGORY_LABELS: Record<SeoAuditCategory, string> = {
  missingTitle: "Başlık eksik",
  duplicateTitle: "Yinelenen başlık",
  missingDescription: "Açıklama eksik",
  invalidDescription: "Açıklama geçersiz",
  canonicalMismatch: "Canonical çakışması",
  missingHreflang: "Hreflang eksik",
  invalidHreflang: "Hreflang geçersiz",
  unexpectedNoindex: "Beklenmeyen noindex",
  orphanRoute: "Erişilemeyen sayfa",
};

const PANEL_LABEL_BY_CONTENT_TYPE: Record<string, string> = {
  [SERVICE_CONTENT_TYPE]: "Hizmet",
  [PRODUCT_CONTENT_TYPE]: "Ürün",
  [PROJECT_CONTENT_TYPE]: "Proje",
  [TEAM_MEMBER_CONTENT_TYPE]: "Ekip üyesi",
  [POST_CONTENT_TYPE]: "Gönderi",
};

/** Re-runs each content type's own already-tested reader to get its real
 * seoTitle/seoDescription-or-fallback pair - never a second, hand-maintained
 * field-extraction rule (AC-6.2-05's own "never disagrees" contract). */
async function loadContentSeoPayload(row: SitemapRouteRow): Promise<ContentSeoPayload | null> {
  const { contentType, locale, slug } = row.route;
  switch (contentType) {
    case SERVICE_CONTENT_TYPE: {
      const service = await getPublishedServiceByRoute(locale, slug);
      if (!service) return null;
      return { title: service.seoTitle ?? service.title, description: service.seoDescription ?? service.summary };
    }
    case PRODUCT_CONTENT_TYPE: {
      const product = await getPublishedProductByRoute(locale, slug);
      if (!product) return null;
      return { title: product.seoTitle ?? product.title, description: product.seoDescription ?? product.summary };
    }
    case PROJECT_CONTENT_TYPE: {
      const project = await getPublishedProjectByRoute(locale, slug);
      if (!project) return null;
      return { title: project.seoTitle ?? project.title, description: project.seoDescription ?? project.category };
    }
    case TEAM_MEMBER_CONTENT_TYPE: {
      const member = await getPublishedTeamMemberByRoute(locale, slug);
      if (!member) return null;
      return { title: member.seoTitle ?? member.name, description: member.seoDescription ?? descriptionOf(member.bio) };
    }
    case POST_CONTENT_TYPE: {
      const post = await getPublishedPostByRoute(locale, slug);
      if (!post) return null;
      return { title: post.seoTitle ?? post.title, description: post.seoDescription ?? post.excerpt };
    }
    default:
      return null;
  }
}

async function loadNavigationReachableUrls(sitemapUrlsByContentType: ReadonlyMap<string, readonly string[]>): Promise<Set<string>> {
  const reachable = new Set<string>();

  const siteSettingsPerLocale = await Promise.all(LOCALES.map((locale) => getPublicSiteSettings(locale as ContentLocale)));
  for (const settings of siteSettingsPerLocale) {
    if (!settings) continue;
    for (const item of settings.navigation) {
      reachable.add(item.url);
      for (const child of item.children) reachable.add(child.url);
    }
    for (const column of settings.footer.columns) {
      for (const link of column.links) reachable.add(link.url);
    }
  }

  for (const [contentType, urls] of sitemapUrlsByContentType) {
    if (!COLLECTION_LISTED_CONTENT_TYPES.has(contentType)) continue;
    for (const url of urls) reachable.add(url);
  }

  return reachable;
}

function severityTone(severity: SeoAuditFinding["severity"]): "danger" | "warning" {
  return severity === "blocking" ? "danger" : "warning";
}

/** SEO audit panel (CAP-3): re-runs CAP-1/CAP-2's own composition against every published route, so it can never disagree with what public metadata actually renders. */
export async function SeoAuditPanel() {
  const contentTypes = [SERVICE_CONTENT_TYPE, PRODUCT_CONTENT_TYPE, PROJECT_CONTENT_TYPE, TEAM_MEMBER_CONTENT_TYPE, POST_CONTENT_TYPE] as const;
  const rowsByType = await Promise.all(contentTypes.map((contentType) => getAllPublishedRoutesForSitemap(prisma, contentType)));
  const rows = rowsByType.flat();

  const sitemapUrlsByContentType = new Map(
    contentTypes.map((contentType, index) => [contentType, rowsByType[index]!.map((row) => generateRoute(row.route))] as const),
  );

  const [contentEntries, defaults, navigationReachableUrls] = await Promise.all([
    Promise.all(rows.map(async (row) => [generateRoute(row.route), await loadContentSeoPayload(row)] as const)),
    getSiteSeoDefaults(prisma, "tr"),
    loadNavigationReachableUrls(sitemapUrlsByContentType),
  ]);

  const contentByRoute = new Map<string, ContentSeoPayload>();
  for (const [url, payload] of contentEntries) {
    if (payload) contentByRoute.set(url, payload);
  }

  const findings = runSeoAudit(rows, contentByRoute, defaults, navigationReachableUrls);
  const blockingCount = findings.filter((finding) => finding.severity === "blocking").length;
  const warningCount = findings.length - blockingCount;

  return (
    <>
      <p role="status" className="mb-4 text-sm font-medium text-brand-text">
        {findings.length === 0
          ? "Hiçbir bulgu yok."
          : `${findings.length} bulgu (${blockingCount} engelleyici, ${warningCount} uyarı).`}
      </p>
      {findings.length === 0 ? (
        <EmptyState title="Temiz" description="Yayınlanan hiçbir sayfada SEO bulgusu yok." />
      ) : (
        <div className={tableWrap}>
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className={tableHeadRow}>
                <th className={tableHeadCell}>Önem</th>
                <th className={tableHeadCell}>Kategori</th>
                <th className={tableHeadCell}>İçerik</th>
                <th className={tableHeadCell}>Dil</th>
                <th className={tableHeadCell}>Ayrıntı</th>
                <th className={tableHeadCell}>Düzenle</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding, index) => (
                <tr key={`${finding.category}-${finding.entityId}-${finding.locale}-${index}`} className={tableRow}>
                  <td className={tableCell}>
                    <ToneBadge tone={severityTone(finding.severity)} label={finding.severity === "blocking" ? "Engelleyici" : "Uyarı"} />
                  </td>
                  <td className={tableCell}>{CATEGORY_LABELS[finding.category]}</td>
                  <td className={tableCell}>{PANEL_LABEL_BY_CONTENT_TYPE[finding.contentType] ?? finding.contentType}</td>
                  <td className={`${tableCell} uppercase`}>{finding.locale}</td>
                  <td className={tableCell}>{finding.detail}</td>
                  <td className={tableCell}>
                    <a href={finding.editorHref} className="font-semibold text-brand-primary hover:underline">
                      Düzenle
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
