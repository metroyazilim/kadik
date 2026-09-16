/**
 * Per-content-type declaration of which payload keys carry a flat rich text
 * (HTML) string - the input `sanitizeCanonicalPayload` (`./sanitization.ts`)
 * needs to know which fields to defensively re-sanitize before a public
 * reader serves them. A content type absent from this map, or present with
 * an empty array, has no flat rich-text field and `sanitizeCanonicalPayload`
 * is a no-op for it.
 *
 * `SERVICE_FIXTURE_CONTENT_TYPE`'s registered shape (title/slug/category/
 * order, Story 0.2's foundation-contract verification fixture) has no rich
 * text field - listed here explicitly, not merely absent, so the mechanism
 * is proven wired end-to-end even though it is a no-op for today's
 * verification domain.
 *
 * Service/Product/Project/Blog's long-form content fields are typed
 * `ContentBlock[]`, not flat rich text - they are registered in
 * `block-field-registry.ts` instead. Team member `bio`, FAQ `answer`, and the About
 * content page's `text` are short single-field rich text with no internal
 * block structure, so they are registered here.
 */
import {
  FAQ_CONTENT_TYPE,
  SERVICE_FIXTURE_CONTENT_TYPE,
  TEAM_MEMBER_CONTENT_TYPE,
} from "./payload-validation";
import { SITE_SETTINGS_CONTENT_TYPE } from "./site-settings-schema";
import { ABOUT_PAGE_CONTENT_TYPE } from "./about-page-schema";

export const RICH_TEXT_FIELDS_BY_CONTENT_TYPE: Readonly<Record<string, readonly string[]>> = {
  [SERVICE_FIXTURE_CONTENT_TYPE]: [],
  [TEAM_MEMBER_CONTENT_TYPE]: ["bio"],
  [FAQ_CONTENT_TYPE]: ["answer"],
  [SITE_SETTINGS_CONTENT_TYPE]: ["termsBody", "privacyBody"],
  [ABOUT_PAGE_CONTENT_TYPE]: ["text"],
};

export function richTextFieldsFor(contentType: string): readonly string[] {
  return RICH_TEXT_FIELDS_BY_CONTENT_TYPE[contentType] ?? [];
}
