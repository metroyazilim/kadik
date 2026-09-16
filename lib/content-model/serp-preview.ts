import type { PublishedRoute } from "./route-registry";
import { generateRoute, type FallbackResolution } from "./route-registry";
import { composeSeoMetadata, type ContentSeoPayload, type SiteSeoDefaults, type SeoMetadata } from "./public-seo";

export type SerpSocialPreview = Readonly<{
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  twitterCard: string;
}>;

/**
 * Generates Google SERP and OpenGraph / Twitter social card preview payload for any published route (Spec 11).
 */
export function generateSerpSocialPreview(
  route: PublishedRoute,
  content: ContentSeoPayload | null,
  defaults: SiteSeoDefaults,
): SerpSocialPreview {
  const nativeUrl = generateRoute(route);
  const fallbackResolution: FallbackResolution = {
    kind: "native",
    url: nativeUrl,
  };

  const meta: SeoMetadata | null = composeSeoMetadata(fallbackResolution, content, defaults);
  const title = meta?.title ?? defaults.siteName;
  const description = meta?.description ?? defaults.defaultDescription;
  const canonicalUrl = meta?.canonical ?? nativeUrl;

  return {
    title,
    description,
    canonicalUrl,
    ogImage: defaults.defaultOgImageUrl ?? undefined,
    twitterCard: "summary_large_image",
  };
}
