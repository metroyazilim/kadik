import { getImageProps } from "next/image";
import { isOptimizedImageHost } from "@/lib/media/image-hosts";

/**
 * Public KADİK images go through the Next.js image optimizer on our own
 * origin rather than straight to the R2 `r2.dev` URL:
 *
 * - `r2.dev` is Cloudflare's rate-limited development endpoint and is
 *   blocked by some content blockers and corporate/ISP filters; the
 *   visitor now only ever talks to kadiklondon.org.
 * - Every upload is WebP. The optimizer negotiates on `Accept` and hands a
 *   JPEG to browsers that cannot decode WebP (Safari before macOS 11 /
 *   iOS 14), which otherwise showed an empty box.
 * - Visitors get a width-appropriate file instead of the full original.
 *
 * SVGs (rejected by the optimizer) and hosts outside
 * `OPTIMIZED_IMAGE_HOSTS` pass through unchanged.
 */
function isOptimizable(src: string): boolean {
  if (!src || /\.svg(?:[?#]|$)/i.test(src)) return false;
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const url = new URL(src);
    return url.protocol === "https:" && isOptimizedImageHost(url.hostname);
  } catch {
    return false;
  }
}

export type KadikImgProps = Readonly<{ src: string; srcSet?: string; sizes?: string }>;

/** `src`/`srcSet`/`sizes` for an `<img>` whose rendered width is described by `sizes`. */
export function kadikImg(src: string, sizes: string): KadikImgProps {
  if (!isOptimizable(src)) return { src };
  const { props } = getImageProps({ src, alt: "", fill: true, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

/** A CSS `url(...)` value for a full-bleed background image. */
export function kadikBackground(src: string, width = 1920): string {
  if (!isOptimizable(src)) return `url("${src}")`;
  const { props } = getImageProps({ src, alt: "", width, height: width });
  // srcSet is "<1x url> 1x, <2x url> 2x"; a section background only needs 1x.
  const oneX = props.srcSet?.split(", ")[0]?.split(" ")[0];
  return `url("${oneX ?? props.src}")`;
}
