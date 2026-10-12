/**
 * Remote hosts whose images are served through the Next.js image optimizer
 * (`/_next/image`) instead of being linked directly. One list feeds both
 * `images.remotePatterns` in `next.config.ts` and the public render helper,
 * so a URL is only rewritten when the optimizer will actually accept it.
 *
 * - `*.r2.dev`: the bucket's public development URL every MediaAsset uses.
 * - `images.unsplash.com`: `lib/media/dummy-images.ts` placeholders.
 *
 * Moving R2 to a custom domain means adding that hostname here.
 */
export const OPTIMIZED_IMAGE_HOSTS = [
  { hostname: "**.r2.dev", matches: (host: string) => host.endsWith(".r2.dev") },
  { hostname: "images.unsplash.com", matches: (host: string) => host === "images.unsplash.com" },
] as const;

export function isOptimizedImageHost(hostname: string): boolean {
  return OPTIMIZED_IMAGE_HOSTS.some((entry) => entry.matches(hostname));
}
