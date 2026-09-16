"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { fieldLabel } from "./ui";
import { richTextExtensions } from "./rich-text/extensions";
import { RichTextToolbar } from "./rich-text/Toolbar";

export type RichTextEditorProps = Readonly<{
  /** Uncontrolled mode: submits a hidden `<input name={name}>` as a real `FormData` field. Omit together with `defaultValue` when using controlled mode. */
  name?: string;
  label: string;
  defaultValue?: string;
  /** Controlled mode (e.g. one block inside `ContentBlockEditor`'s array state): pass both `value` and `onChange`; no `name` is rendered. */
  value?: string;
  onChange?: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  required?: boolean;
  onDirty?: () => void;
}>;

/**
 * Reusable rich-text field shared by every long-content domain (Service/
 * Product/Blog TEXT blocks, Team bio, FAQ answer, Home section body/text).
 * A real Tiptap WYSIWYG instance is the value carrier (Spec 4) - the
 * administrator selects text and applies formatting; no HTML tag text is
 * ever visible. This is a *convenience editor, not a trust boundary*: the
 * value it produces is always re-sanitized server-side through
 * `lib/content-model/sanitization.ts`'s `sanitizeRichHtml` before it is
 * ever persisted or rendered, so a hand-crafted `<script>` pasted directly
 * into the editor is stripped there, not here. Both extension set and
 * server sanitizer derive from the one shared allow-list
 * (`lib/content-model/rich-text-allowlist.ts`), so nothing the editor can
 * produce is ever silently dropped at save time.
 *
 * Supports both an uncontrolled mode (`name`+`defaultValue`, submits via
 * native `FormData` - every flat rich-text field: Team bio, FAQ answer,
 * Home block fields) and a controlled mode (`value`+`onChange` - each TEXT
 * block inside `ContentBlockEditor`, which owns the whole block array as
 * one JSON hidden field instead), mirroring `MediaField`'s existing
 * dual-mode pattern. Content is set into the editor once at mount from
 * whichever of `defaultValue`/`value` is present; a controlled instance
 * additionally re-syncs from a later external `value` change (e.g. a
 * programmatic reset) but never from its own `onChange` echo, so typing
 * never loops or gets clobbered. Uncontrolled instances rely on the call
 * site remounting with a fresh `key` for a genuine content swap (locale-tab
 * switch), exactly as the pre-Spec-4 textarea's `defaultValue` did.
 */
export function RichTextEditor({
  name,
  label,
  defaultValue,
  value: controlledValue,
  onChange,
  maxLength,
  placeholder,
  required = false,
  onDirty,
}: RichTextEditorProps) {
  const generatedId = useId();
  const fieldId = name ?? generatedId;
  const isControlled = controlledValue !== undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      ...richTextExtensions(),
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ],
    content: controlledValue ?? defaultValue ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: fieldId,
        "aria-labelledby": `${fieldId}-label`,
        dir: "auto",
        role: "textbox",
        "aria-multiline": "true",
        "aria-required": required ? "true" : "false",
        class:
          "rt-content max-w-none focus:outline-none [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-bold [&_h4]:mt-2 [&_h4]:text-base [&_h4]:font-bold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-6 [&_blockquote]:my-2 [&_blockquote]:border-s-2 [&_blockquote]:border-brand-border [&_blockquote]:ps-3 [&_blockquote]:text-brand-muted [&_a]:text-brand-primary [&_a]:underline [&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-start [&_.is-editor-empty]:before:h-0 [&_.is-editor-empty]:before:text-brand-muted [&_.is-editor-empty]:before:content-[attr(data-placeholder)]",
      },
    },
    onUpdate: ({ editor: current }) => {
      setBlockedReason(null);
      if (isControlled) onChange?.(current.getHTML());
      onDirty?.();
    },
  });

  // Controlled external-value sync: only push a new value into the editor
  // when it actually differs from what the editor itself last produced -
  // never on every render. `setContent` dispatches a real ProseMirror
  // transaction even with `emitUpdate: false`, so `useEditor`'s own
  // transaction subscription re-renders this component with the new
  // content already reflected in `editor.getHTML()` below - no separate
  // React state to keep in sync, so nothing here can loop or desync.
  useEffect(() => {
    if (!isControlled || !editor || controlledValue === undefined) return;
    if (controlledValue === editor.getHTML()) return;
    editor.commands.setContent(controlledValue, { emitUpdate: false });
  }, [isControlled, controlledValue, editor]);

  // Hidden inputs do not participate in browser constraint validation, so
  // enforce required/length rules on the owning form's submit event.
  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form || !editor) return;
    const handleSubmit = (event: SubmitEvent) => {
      if (required && editor.getText().trim().length === 0) {
        event.preventDefault();
        setBlockedReason(`${label} alanı boş olamaz.`);
        editor.commands.focus();
        return;
      }
      if (editor.getHTML().length > maxLength) {
        event.preventDefault();
        setBlockedReason(`${label} alanı en fazla ${maxLength} karakter olabilir.`);
        editor.commands.focus();
      }
    };
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [editor, required, maxLength, label]);

  if (!editor) {
    return (
      <div className="space-y-2" ref={containerRef}>
        <span className={fieldLabel}>{label}</span>
        <p role="status" className="h-40 rounded-lg border border-brand-border bg-brand-page p-3 text-sm text-brand-muted">
          Yükleniyor…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <RichTextEditorBody editor={editor} fieldId={fieldId} label={label} name={isControlled ? undefined : name} maxLength={maxLength} />
      {blockedReason ? (
        <p role="alert" className="text-xs font-medium text-brand-danger">
          {blockedReason}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Split out from `RichTextEditor` so `useEditorState` is created on this
 * subcomponent's own first render, with `editor` already non-null - exactly
 * how `RichTextToolbar` already works. Calling `useEditorState` in the
 * outer component instead (before its own `if (!editor)` guard, which rules
 * of hooks require) captures `EditorStateManager`'s internal state against
 * the `null` `editor` React returns on Next.js's mandatory first
 * (`immediatelyRender: false`) render; the initial content set moments
 * later at construction dispatches its transaction before this component
 * ever attaches a watcher to the *real* editor instance, so the counter and
 * hidden input would permanently miss it and stay stuck reporting empty.
 */
function RichTextEditorBody({
  editor,
  fieldId,
  label,
  name,
  maxLength,
}: {
  editor: Editor;
  fieldId: string;
  label: string;
  name: string | undefined;
  maxLength: number;
}) {
  const html =
    useEditorState({
      editor,
      selector: ({ editor: current }) => current.getHTML(),
    }) ?? "";
  const overLimit = html.length > maxLength;

  return (
    <>
      <div className="flex items-center justify-between">
        <label id={`${fieldId}-label`} htmlFor={fieldId} className={fieldLabel}>
          {label}
        </label>
        <span className={`text-xs ${overLimit ? "font-semibold text-brand-danger" : "text-brand-muted"}`}>
          {html.length} / {maxLength}
        </span>
      </div>

      <RichTextToolbar editor={editor} label={label} />

      <EditorContent
        editor={editor}
        className="rt-editor block w-full rounded-b-lg border border-t-0 border-brand-border bg-white p-3 text-sm text-brand-text focus-within:border-brand focus-within:ring-1 focus-within:ring-brand [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:h-auto [&_.ProseMirror]:outline-none"
      />

      {name ? <input type="hidden" name={name} value={html} /> : null}
    </>
  );
}
