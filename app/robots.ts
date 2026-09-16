import type { MetadataRoute } from "next";
import { buildRobotsDirectives } from "@/lib/content-model/public-seo";
import { SITE_URL } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const directives = buildRobotsDirectives(`${SITE_URL}/sitemap.xml`);
  return {
    rules: directives.rules.map((rule) => ({ userAgent: rule.userAgent, disallow: [...rule.disallow] })),
    sitemap: directives.sitemap,
  };
}
