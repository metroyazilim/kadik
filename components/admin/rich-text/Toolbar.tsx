"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Bold, Italic, Underline, List, ListOrdered, Quote, Link2, Unlink, Undo2, Redo2, Pilcrow } from "lucide-react";
import { isAllowedRichTextUrl } from "./extensions";

type ToolbarButtonProps = Readonly<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}>;

function ToolbarButton({ onClick, active = false, disabled = false, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded text-brand-text hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-white text-brand-primary shadow-sm" : ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Toolbar for `RichTextEditor` (Spec 4). `role="toolbar"` with mark buttons
 * exposing `aria-pressed` (AC-4.14). Heading levels are limited to H2-H4:
 * `docs/context/ui-context.md`'s accessibility baseline requires exactly
 * one page `h1`, so the shared long-form editor never offers an admin a way
 * to introduce a second one, even though the sanitizer's allow-list (a
 * superset, for legacy-content round-tripping) permits `h1` and `h5`/`h6`.
 */
export function RichTextToolbar({ editor, label }: { editor: Editor; label: string }) {
  const [linkDraftOpen, setLinkDraftOpen] = useState(false);
  const [linkDraftUrl, setLinkDraftUrl] = useState("");
  const [linkDraftInvalid, setLinkDraftInvalid] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      paragraph: current.isActive("paragraph"),
      heading2: current.isActive("heading", { level: 2 }),
      heading3: current.isActive("heading", { level: 3 }),
      heading4: current.isActive("heading", { level: 4 }),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const openLinkDraft = () => {
    const existingHref = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkDraftUrl(existingHref);
    setLinkDraftInvalid(false);
    setLinkDraftOpen(true);
  };

  const confirmLinkDraft = () => {
    const url = linkDraftUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkDraftOpen(false);
      return;
    }
    if (!isAllowedRichTextUrl(url)) {
      setLinkDraftInvalid(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkDraftOpen(false);
  };

  return (
    <div className="rounded-t-lg border border-brand-border bg-brand-page">
      <div role="toolbar" aria-label={`${label} biçimlendirme araç çubuğu`} className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
        <ToolbarButton label="Paragraf" active={state.paragraph} onClick={() => editor.chain().focus().setParagraph().run()}>
          <Pilcrow className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="H2 stili" active={state.heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="text-[11px] font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton label="H3 stili" active={state.heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <span className="text-[11px] font-bold">H3</span>
        </ToolbarButton>
        <ToolbarButton label="H4 stili" active={state.heading4} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
          <span className="text-[11px] font-bold">H4</span>
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-brand-border" aria-hidden="true" />
        <ToolbarButton label="Kalın" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="İtalik" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Altı çizili" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-brand-border" aria-hidden="true" />
        <ToolbarButton label="Madde listesi" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Numaralı liste" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Alıntı" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-brand-border" aria-hidden="true" />
        <ToolbarButton label={state.link ? "Metin bağlantısını düzenle" : "Metin bağlantısı ekle"} active={state.link} onClick={openLinkDraft}>
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        {state.link ? (
          <ToolbarButton label="Metin bağlantısını kaldır" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>
            <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
        ) : null}
        <span className="mx-1 h-4 w-px bg-brand-border" aria-hidden="true" />
        <ToolbarButton label="Geri al" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Yinele" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
      </div>

      {linkDraftOpen ? (
        <div className="flex items-center gap-2 border-t border-brand-border bg-blue-50 p-2 text-xs">
          <input
            type="url"
            placeholder="https://... veya /hizmetler"
            value={linkDraftUrl}
            onChange={(event) => {
              setLinkDraftUrl(event.target.value);
              setLinkDraftInvalid(false);
            }}
            aria-invalid={linkDraftInvalid}
            aria-label="Bağlantı adresi"
            className="flex-1 rounded border border-brand-border bg-white px-2 py-1 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="button"
            onClick={confirmLinkDraft}
            className="rounded bg-brand-primary px-3 py-1 font-medium text-white hover:opacity-90"
          >
            Ekle
          </button>
          <button
            type="button"
            onClick={() => setLinkDraftOpen(false)}
            className="rounded border border-brand-border bg-white px-2 py-1 text-brand-muted hover:text-brand-text"
          >
            İptal
          </button>
          {linkDraftInvalid ? (
            <p role="alert" className="basis-full text-brand-danger">
              Bu adres türü desteklenmiyor. http(s), mailto, tel veya site içi bağlantı (/ veya #) kullanın.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
