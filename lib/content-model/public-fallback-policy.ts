import type { ContentLocale } from "@prisma/client";
import type { PublicProjectionEmptyReason, PublicTranslationProjection } from "./public-content-reader";

/**
 * `PublicFallbackPolicy`'s pure decision function (AD-5, Story 5.1 CAP-1).
 * Pure - no Prisma import, no I/O - mirroring `route-registry.ts`'s
 * `resolvePublicRoute` purity precedent exactly.
 *
 * `requestedLocale === "tr"` with no native translation always decides
 * `{ kind: "empty", reason: "no-published-any-locale" }` - Turkish is the
 * source locale (AD-6/A-4: "Türkçe kaynak locale'dir"), so there is no
 * further fallback to check; `resolve()` must not issue a second,
 * redundant Turkish lookup identical to the native one it already ran.
 * Any other requested locale with no native translation decides
 * `{ kind: "checkTurkish" }`; `resolve()` then performs the Turkish lookup
 * itself and classifies the final result.
 */
export type ContentFallbackDecision =
  | Readonly<{ kind: "native" }>
  | Readonly<{ kind: "checkTurkish" }>
  | Readonly<{ kind: "empty"; reason: PublicProjectionEmptyReason }>;

export function resolveContentFallback(
  requestedLocale: ContentLocale,
  nativeTranslation: PublicTranslationProjection | null,
): ContentFallbackDecision {
  if (nativeTranslation) return { kind: "native" };
  if (requestedLocale === "tr") return { kind: "empty", reason: "no-published-any-locale" };
  return { kind: "checkTurkish" };
}
