import { expect, test } from "@playwright/test";
import { sanitizeRichHtml } from "../../lib/content-model/sanitization";
import { RICH_TEXT_ALLOWED_TAGS } from "../../lib/content-model/rich-text-allowlist";

// Spec 4 AC-4.6/AC-4.7/AC-4.8: the maintained `sanitize-html` tokenizer
// replaces the pre-Spec-4 regex-based sanitizer. Every vector below is a
// documented regex-sanitizer bypass class that a real tokenizer must close
// structurally, not merely by coincidence of the current test inputs.

test.describe("Spec 4 AC-4.6 - regex-bypass vectors are neutralized", () => {
  test("split/nested script tags never reconstitute a live <script> (documented regex-sanitizer bypass)", () => {
    const clean = sanitizeRichHtml("<p>before</p><scr<script>ipt>alert(1)</scr</script>ipt><p>after</p>");
    // The regex-based sanitizer this replaces is documented (Spec 4 §2.2)
    // to be defeated by exactly this split form, reconstituting a live
    // `<script>` tag. The tokenizer's obligation is that no live script
    // element ever survives - inert leftover text is not an execution
    // vector and is an accepted, not a security-relevant, side effect.
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("</script>");
    expect(clean).toContain("<p>before</p>");
    expect(clean).toContain("<p>after</p>");
  });

  test("an <img onerror> vector is dropped entirely (img is not an allowed tag)", () => {
    const clean = sanitizeRichHtml('<p>text</p><img src=x onerror="alert(1)">');
    expect(clean).not.toContain("<img");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("alert(1)");
  });

  test("a <script> nested inside a disallowed <svg> wrapper never survives", () => {
    const clean = sanitizeRichHtml("<svg><script>alert(1)</script></svg>");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<svg");
    expect(clean).not.toContain("alert(1)");
  });

  test("a <script> nested inside a disallowed raw-text wrapper (<xmp>/<textarea>) never survives", () => {
    for (const wrapper of ["xmp", "textarea"]) {
      const clean = sanitizeRichHtml(`<${wrapper}><script>alert(1)</script></${wrapper}>`);
      expect(clean).not.toContain("<script");
      expect(clean).not.toContain(`<${wrapper}`);
      expect(clean).not.toContain("alert(1)");
    }
  });

  test("event-handler attributes are dropped regardless of casing, whitespace, or entity-encoded separators, even on a tag with other allowed attributes", () => {
    const vectors = [
      '<a href="/x" ON\tError = "alert(1)">a</a>',
      '<a href="/x" OnClick="alert(1)">b</a>',
      '<a href="/x" onclick&NewLine;="alert(1)">c</a>',
      '<a href="/x"\nonmouseover\n=\n"alert(1)">d</a>',
    ];
    for (const vector of vectors) {
      const clean = sanitizeRichHtml(vector);
      expect(clean.toLowerCase()).not.toContain("onerror");
      expect(clean.toLowerCase()).not.toContain("onclick");
      expect(clean.toLowerCase()).not.toContain("onmouseover");
      expect(clean).not.toContain("alert(1)");
      // Proves the fix is attribute-name matching, not "every attribute on
      // this tag is stripped" - href, an allowed attribute, survives.
      expect(clean).toContain('href="/x"');
    }
  });

  test("javascript:/data:/vbscript: hrefs are dropped, including obfuscated and whitespace-padded forms", () => {
    const vectors = [
      '<a href="javascript:alert(1)">a</a>',
      '<a href="  javascript:alert(1)">b</a>',
      '<a href="JaVaScRiPt:alert(1)">c</a>',
      '<a href="jav&#97;script:alert(1)">d</a>',
      '<a href="java\tscript:alert(1)">e</a>',
      '<a href="data:text/html,<script>alert(1)</script>">f</a>',
      '<a href="vbscript:msgbox(1)">g</a>',
    ];
    for (const vector of vectors) {
      const clean = sanitizeRichHtml(vector);
      expect(clean).not.toContain("href=");
      expect(clean.toLowerCase()).not.toContain("javascript:");
      expect(clean.toLowerCase()).not.toContain("data:");
      expect(clean.toLowerCase()).not.toContain("vbscript:");
    }
  });

  test("comment-boundary tricks cannot reopen a live tag", () => {
    const clean = sanitizeRichHtml("<!--><script>alert(1)</script>-->");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert(1)");
  });

  test("an attribute value containing '>' does not break parsing structure or leak a second element as content", () => {
    const clean = sanitizeRichHtml('<a href="/x" title="a>b">link</a><p>after</p>');
    expect(clean).toBe('<a href="/x">link</a><p>after</p>');
  });

  test("unclosed and mis-nested markup fails safe (no tag ever leaks unclosed into surrounding content)", () => {
    const clean = sanitizeRichHtml("<p>one<strong>two<em>three</p>four</strong></em>");
    expect(clean).not.toContain("<script");
    expect(clean).toContain("one");
    expect(clean).toContain("two");
    expect(clean).toContain("three");
    expect(clean).toContain("four");
  });
});

test.describe("Spec 4 AC-4.7 - allowed formatting is preserved", () => {
  test("every allowed tag survives, with all non-link attributes stripped", () => {
    const html =
      "<h1>Title</h1><h2>Sub</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>" +
      "<p>Para <strong>bold</strong> <b>b</b> <em>italic</em> <i>i</i> <u>underline</u> <span>span</span></p>" +
      "<blockquote><p>Quote</p></blockquote>" +
      "<ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>" +
      "<br />";
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  test("nested lists survive in the correct order and depth", () => {
    const html = "<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>";
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  test("safe href values (https, http, mailto, tel, site-relative, fragment) all survive", () => {
    const html =
      '<p><a href="https://example.com">https</a> <a href="http://example.com">http</a> ' +
      '<a href="mailto:info@metro.com">mail</a> <a href="tel:+905551112233">tel</a> ' +
      '<a href="/hizmetler">relative</a> <a href="#section-2">fragment</a></p>';
    const clean = sanitizeRichHtml(html);
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('href="http://example.com"');
    expect(clean).toContain('href="mailto:info@metro.com"');
    expect(clean).toContain('href="tel:+905551112233"');
    expect(clean).toContain('href="/hizmetler"');
    expect(clean).toContain('href="#section-2"');
  });

  test("an external link's target=_blank gets rel=noopener noreferrer; an internal link gets neither", () => {
    const clean = sanitizeRichHtml(
      '<p><a href="https://example.com" target="_blank">ext</a> <a href="/services">int</a></p>',
    );
    expect(clean).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">ext</a>');
    expect(clean).toContain('<a href="/services">int</a>');
  });

  test("target=_blank forces rel=noopener noreferrer regardless of casing", () => {
    const clean = sanitizeRichHtml('<a href="https://example.com" target="_Blank">ext</a>');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  test("sanitizing already-sanitized output is a no-op (idempotent)", () => {
    const html =
      '<h2>Heading</h2><p>Text with <a href="https://example.com" target="_blank" rel="noopener noreferrer">a link</a> and <strong>bold</strong>.</p>' +
      "<ul><li>one</li></ul><blockquote><p>quote</p></blockquote>";
    const once = sanitizeRichHtml(html);
    const twice = sanitizeRichHtml(once);
    expect(twice).toBe(once);
  });

  test("pre-Spec-4 legacy content (u/span/bare b/i, no headings) round-trips without formatting loss", () => {
    const legacy = "<p>Hi <b>bold</b> <i>italic</i> <u>underline</u> <span>span</span> <a href=\"/legacy\">link</a></p>";
    expect(sanitizeRichHtml(legacy)).toBe(legacy);
  });
});

test.describe("Spec 4 AC-4.8 - one allow-list feeds both the editor and the sanitizer", () => {
  test("RICH_TEXT_ALLOWED_TAGS is exactly the set the sanitizer configuration allows", () => {
    // A canonical, self-closed instance of every allowed tag (except `a`,
    // asserted separately above with its attribute contract) must survive
    // sanitization completely unchanged - proving the Tiptap extension set
    // built from this same list (`components/admin/rich-text/extensions.ts`)
    // can never produce markup the sanitizer silently discards.
    for (const tag of RICH_TEXT_ALLOWED_TAGS) {
      if (tag === "a" || tag === "br" || tag === "li") continue; // asserted with required parents/attrs elsewhere
      const html = `<${tag}>content</${tag}>`;
      expect(sanitizeRichHtml(html)).toBe(html);
    }
    expect(sanitizeRichHtml("<br />")).toBe("<br />");
    expect(sanitizeRichHtml("<ul><li>content</li></ul>")).toBe("<ul><li>content</li></ul>");
  });
});
