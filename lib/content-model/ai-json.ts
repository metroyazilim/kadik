/**
 * Chat UIs auto-linkify e-mail addresses and URLs, so a model that returns
 * correct JSON still arrives as corrupted text: `"a@b.com"` comes back as
 * `"[a@b.com](mailto:a@b.com)"`, and a link that starts mid-value swallows
 * the rest of the JSON structure into a percent-encoded href
 * (`[…"instagram":"https://…](https://…%22,%22instagram%22…)`).
 *
 * In every one of those cases the *label* is the original text - the href is
 * a derived copy - so unwrapping `[label](target)` back to `label` restores
 * the exact bytes the model produced. Only http(s)/mailto targets are
 * unwrapped, so genuine bracket text in content is left alone.
 */
const MARKDOWN_LINK = /\[([^\]]*)\]\((?:mailto:|https?:)[^)\s]*\)/g;
const CODE_FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

export function repairAiJsonText(raw: string): string {
  const withoutFence = raw.match(CODE_FENCE)?.[1] ?? raw;
  return withoutFence.replace(MARKDOWN_LINK, "$1").trim();
}
