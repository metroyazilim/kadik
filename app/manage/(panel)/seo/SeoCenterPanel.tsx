import { SeoAuditPanel } from "./SeoAuditPanel";
import { card, cn } from "@/components/admin/ui";
import { prisma } from "@/lib/db";
import { getAllPublishedRoutesForSitemap } from "@/lib/content-model/route-reader";
import { getSiteSeoDefaults } from "@/lib/content-model/site-seo-defaults";
import { generateSerpSocialPreview } from "@/lib/content-model/serp-preview";

export async function SeoCenterPanel() {
  const defaults = await getSiteSeoDefaults(prisma, "tr");
  const routes = await getAllPublishedRoutesForSitemap(prisma, "service");

  const sampleRoute = routes[0];
  const samplePreview = sampleRoute ? generateSerpSocialPreview(sampleRoute.route, null, defaults) : null;

  return (
    <div className="space-y-6">
      {samplePreview ? (
        <div className={cn(card, "p-5 space-y-4")}>
          <h2 className="text-sm font-semibold text-brand-text">Canlı Google SERP / Sosyal Önizleme (Örnek)</h2>
          <div className="rounded border border-brand-border bg-brand-page p-4 space-y-2 max-w-2xl font-sans">
            <p className="text-xs text-brand-muted truncate">{samplePreview.canonicalUrl}</p>
            <p className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">{samplePreview.title}</p>
            <p className="text-xs text-brand-text line-clamp-2">{samplePreview.description}</p>
          </div>
        </div>
      ) : null}

      <SeoAuditPanel />
    </div>
  );
}
