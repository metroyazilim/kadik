import StarterKit from "@tiptap/starter-kit";
import type { AnyExtension } from "@tiptap/core";
import { RICH_TEXT_ALLOWED_URL_SCHEMES } from "@/lib/content-model/rich-text-allowlist";

/**
 * The Tiptap extension set every `RichTextEditor` instance uses, built from
 * the same shared allow-list (`rich-text-allowlist.ts`) that configures the
 * server sanitizer (`lib/content-model/sanitization.ts`) - the mechanism
 * Spec 4 AC-4.8 requires: the editor can never produce a tag the sanitizer
 * would then discard, because both read the same list.
 *
 * Starter Kit 3.31 already bundles Bold/Italic/Underline/Link/Blockquote/
 * Heading/(Un)OrderedList/ListItem/Paragraph/Document/Text plus non-content
 * UX extensions (Dropcursor, Gapcursor, UndoRedo, TrailingNode, ListKeymap) -
 * `code`/`codeBlock`/`horizontalRule`/`strike` are explicitly disabled here
 * because their tags (`code`, `pre`, `hr`, `s`/`strike`) are not in the
 * shared allow-list and the required minimum toolbar
 * (`docs/context/ui-context.md`) never calls for them.
 */
export function richTextExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: true,
        protocols: [...RICH_TEXT_ALLOWED_URL_SCHEMES],
        HTMLAttributes: {},
      },
    }),
  ];
}

/** Same scheme policy the sanitizer enforces, applied client-side so the toolbar's link control never offers to create a link the server will drop - the editor is not a trust boundary; this is UX, not enforcement. */
export function isAllowedRichTextUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (!schemeMatch) return false;
  return (RICH_TEXT_ALLOWED_URL_SCHEMES as readonly string[]).includes(schemeMatch[1].toLowerCase());
}
