"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { EditorSection } from "@/components/admin/EditorSection";
import { MediaField } from "@/components/admin/MediaField";
import { SortableDragHandleIcon, SortableList } from "@/components/admin/SortableList";
import { useToast } from "@/components/admin/Toast";
import {
  card,
  cn,
  dangerLinkButton,
  fieldHint,
  fieldInput,
  fieldLabel,
  fieldTextarea,
  helpText,
  iconButton,
  primaryButton,
  secondaryButton,
} from "@/components/admin/ui";
import {
  getAtPath,
  joinPath,
  setAtPath,
  type KadikField,
  type KadikListField,
  type KadikScalarField,
  type KadikStringListField,
} from "@/lib/kadik-content/fields";
import { KADIK_PAGE_DEFINITIONS, type KadikContentKey, type KadikPageData } from "@/lib/kadik-content/pages";
import type { KadikImage } from "@/lib/kadik-i18n";
import { resetKadikPageAction, saveKadikPageAction } from "./kadik-actions";

type Row = Record<string, unknown>;

let idCounter = 0;
const newId = () => `row-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function emptyValue(field: KadikScalarField): unknown {
  if (field.kind === "image") return { url: "", assetId: null } satisfies KadikImage;
  if (field.kind === "select") return field.options?.[0]?.value ?? "";
  return "";
}

/* ------------------------------------------------------------ Scalar input */

function ScalarInput({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: KadikScalarField;
  value: unknown;
  onChange: (value: unknown) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.key}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const label = field.label;
  const hint = field.hint ? <span className={fieldHint}>{field.hint}</span> : null;
  const heading = (
    <label className={fieldLabel} htmlFor={id}>
      {label}
      {hint}
    </label>
  );

  if (field.kind === "image") {
    const image = (value ?? { url: "", assetId: null }) as KadikImage;
    return (
      <div>
        <MediaField
          label={label}
          value={image.url}
          assetId={image.assetId ?? undefined}
          contextLabel={label}
          onChange={(payload) => onChange({ url: payload.url, assetId: payload.assetId ?? null } satisfies KadikImage)}
          description={image.url && !image.assetId ? "Sitedeki hazır görsel kullanılıyor. Değiştirmek için medya kütüphanesinden seçin veya yükleyin." : undefined}
        />
        {hint}
      </div>
    );
  }

  const stringValue = typeof value === "string" ? value : "";
  if (field.kind === "textarea") {
    return (
      <div>
        {heading}
        <textarea
          id={id}
          className={fieldTextarea}
          rows={Math.min(10, Math.max(3, Math.ceil(stringValue.length / 90)))}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }
  if (field.kind === "select") {
    return (
      <div>
        {heading}
        <select id={id} className={fieldInput} value={stringValue} onChange={(event) => onChange(event.target.value)}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div>
      {heading}
      <input
        id={id}
        className={fieldInput}
        type={field.kind === "date" ? "date" : "text"}
        inputMode={field.kind === "url" ? "url" : undefined}
        placeholder={field.kind === "url" ? "https://" : undefined}
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- List input */

function useRowIds(length: number) {
  // Index-based initial ids: rendered on the server and the client alike, so
  // they must be deterministic (a time-based id would break hydration).
  const [ids, setIds] = useState<string[]>(() => Array.from({ length }, (_, index) => `initial-${index}`));
  // Keeps ids aligned if the list is replaced from outside (e.g. after a reset).
  const aligned = ids.length === length ? ids : Array.from({ length }, (_, index) => ids[index] ?? newId());
  return [aligned, setIds] as const;
}

function ListInput({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: KadikListField;
  value: unknown;
  onChange: (value: Row[]) => void;
  idPrefix: string;
}) {
  const rows = (Array.isArray(value) ? value : []) as Row[];
  const [ids, setIds] = useRowIds(rows.length);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const items = ids.map((id, index) => ({ id, row: rows[index] ?? {}, index }));
  const max = field.max ?? 200;

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = () => {
    const id = newId();
    const row: Row = Object.fromEntries(field.fields.map((sub) => [sub.key, emptyValue(sub)]));
    setIds([...ids, id]);
    setOpen(new Set([...open, id]));
    onChange([...rows, row]);
  };

  const remove = (index: number) => {
    const title = String(rows[index]?.[field.titleKey] ?? "").trim();
    if (!window.confirm(`"${title || `${field.itemLabel} ${index + 1}`}" silinsin mi?`)) return;
    setIds(ids.filter((_, position) => position !== index));
    onChange(rows.filter((_, position) => position !== index));
  };

  const reorder = (nextIds: readonly string[]) => {
    const byId = new Map(items.map((item) => [item.id, item.row]));
    setIds([...nextIds]);
    onChange(nextIds.map((id) => byId.get(id) ?? {}));
  };

  const update = (index: number, key: string, next: unknown) =>
    onChange(rows.map((row, position) => (position === index ? { ...row, [key]: next } : row)));

  return (
    <fieldset className="space-y-2">
      <legend className={fieldLabel}>
        {field.label}
        <span className="ml-2 font-normal normal-case tracking-normal text-brand-muted">({rows.length})</span>
      </legend>
      {field.hint ? <p className={helpText}>{field.hint}</p> : null}
      <ul className="space-y-2">
        <SortableList
          items={items}
          onReorder={reorder}
          renderItem={(item, { setNodeRef, style, dragHandleProps }) => {
            const expanded = open.has(item.id);
            const title = String(item.row[field.titleKey] ?? "").trim();
            const thumb = field.fields.find((sub) => sub.kind === "image");
            const thumbUrl = thumb ? (item.row[thumb.key] as KadikImage | undefined)?.url : undefined;
            return (
              <li ref={setNodeRef} style={style} className={cn(card, "overflow-hidden")}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" {...dragHandleProps} aria-label="Sürükleyerek sırala" title="Sürükleyerek sırala">
                    <SortableDragHandleIcon />
                  </button>
                  {thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl} alt="" className="size-9 shrink-0 rounded-[var(--radius-sm)] object-cover" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                  >
                    <span className="shrink-0 text-xs font-bold text-brand-muted">{item.index + 1}.</span>
                    <span className={cn("truncate", title ? "text-brand-text" : "italic text-brand-muted")}>
                      {title || `${field.itemLabel} ${item.index + 1}`}
                    </span>
                    <ChevronDown className={cn("ml-auto size-4 shrink-0 text-brand-muted transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={cn(iconButton, "hover:text-brand-danger")}
                    onClick={() => remove(item.index)}
                    aria-label="Sil"
                    title="Sil"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
                {expanded ? (
                  <div className="grid gap-4 border-t border-brand-border bg-brand-page/50 p-4 md:grid-cols-2">
                    {field.fields.map((sub) => (
                      <div key={sub.key} className={sub.kind === "textarea" || sub.kind === "image" ? "md:col-span-2" : undefined}>
                        <ScalarInput
                          field={sub}
                          value={item.row[sub.key]}
                          onChange={(next) => update(item.index, sub.key, next)}
                         
                          idPrefix={`${idPrefix}-${item.id}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          }}
        />
      </ul>
      {rows.length < max ? (
        <button type="button" onClick={add} className={secondaryButton}>
          <Plus className="size-3.5" aria-hidden="true" />
          {field.itemLabel} ekle
        </button>
      ) : null}
    </fieldset>
  );
}

function StringListInput({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: KadikStringListField;
  value: unknown;
  onChange: (value: string[]) => void;
  idPrefix: string;
}) {
  const values = (Array.isArray(value) ? value : []).map((entry) => (typeof entry === "string" ? entry : ""));
  const [ids, setIds] = useRowIds(values.length);
  const items = ids.map((id, index) => ({ id, value: values[index] ?? "", index }));
  const max = field.max ?? 200;

  return (
    <fieldset className="space-y-2">
      <legend className={fieldLabel}>{field.label}</legend>
      {field.hint ? <p className={helpText}>{field.hint}</p> : null}
      <ul className="space-y-2">
        <SortableList
          items={items}
          onReorder={(nextIds) => {
            const byId = new Map(items.map((item) => [item.id, item.value]));
            setIds([...nextIds]);
            onChange(nextIds.map((id) => byId.get(id) ?? ""));
          }}
          renderItem={(item, { setNodeRef, style, dragHandleProps }) => (
            <li ref={setNodeRef} style={style} className="flex items-center gap-2">
              <button type="button" {...dragHandleProps} aria-label="Sürükleyerek sırala" title="Sürükleyerek sırala">
                <SortableDragHandleIcon />
              </button>
              <input
                id={`${idPrefix}-${item.id}`}
                aria-label={`${field.itemLabel} ${item.index + 1}`}
                className={cn(fieldInput, "mt-0")}
                value={item.value}
                onChange={(event) => onChange(values.map((entry, position) => (position === item.index ? event.target.value : entry)))}
              />
              <button
                type="button"
                className={cn(iconButton, "hover:text-brand-danger")}
                onClick={() => {
                  setIds(ids.filter((_, position) => position !== item.index));
                  onChange(values.filter((_, position) => position !== item.index));
                }}
                aria-label="Sil"
                title="Sil"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          )}
        />
      </ul>
      {values.length < max ? (
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            setIds([...ids, newId()]);
            onChange([...values, ""]);
          }}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {field.itemLabel} ekle
        </button>
      ) : null}
    </fieldset>
  );
}

function FieldInput({
  field,
  path,
  data,
  setData,
}: {
  field: KadikField;
  path: string;
  data: KadikPageData;
  setData: (updater: (current: KadikPageData) => KadikPageData) => void;
}) {
  const value = getAtPath(data, path);
  const onChange = (next: unknown) => setData((current) => setAtPath(current, path, next));
  const idPrefix = `kadik-${path}`;
  if (field.kind === "list") return <ListInput field={field} value={value} onChange={onChange} idPrefix={idPrefix} />;
  if (field.kind === "stringList") return <StringListInput field={field} value={value} onChange={onChange} idPrefix={idPrefix} />;
  return <ScalarInput field={field} value={value} onChange={onChange} idPrefix={idPrefix} />;
}

/* ------------------------------------------------------------------ Editor */

export function KadikPageEditor({
  pageKey,
  initialData,
  updatedAt,
}: {
  pageKey: KadikContentKey;
  initialData: KadikPageData;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const definition = KADIK_PAGE_DEFINITIONS[pageKey];
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialData));
  const [data, setData] = useState<KadikPageData>(initialData);
  // Remounts list editors (fresh row ids) after the content is replaced wholesale.
  const [revision, setRevision] = useState(0);
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(data) !== baseline, [data, baseline]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startTransition(async () => {
      const result = await saveKadikPageAction(pageKey, data);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setBaseline(JSON.stringify(data));
        router.refresh();
      }
    });

  const reset = () => {
    if (!window.confirm("Bu sayfadaki metin ve görseller sitenin ilk hâline döndürülecek (SEO ayarları korunur). Emin misiniz?")) return;
    startTransition(async () => {
      const result = await resetKadikPageAction(pageKey);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        // The server component re-renders with the restored content; remount with it.
        window.location.reload();
      }
    });
  };

  const discard = () => {
    const restored = JSON.parse(baseline) as KadikPageData;
    setData(restored);
    setRevision((value) => value + 1);
  };

  const lastSaved = updatedAt
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(updatedAt))
    : null;

  return (
    <div className="space-y-4">
      <div className={cn(card, "sticky top-[57px] z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3")}>
        <div className="min-w-0 text-xs text-brand-muted">
          {dirty ? (
            <span className="font-bold text-brand-warning">Kaydedilmemiş değişiklikler var</span>
          ) : lastSaved ? (
            `Son kayıt: ${lastSaved}`
          ) : (
            "Sitenin ilk içeriği gösteriliyor"
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {definition.publicPath ? (
            <a href={definition.publicPath} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Sitede gör
            </a>
          ) : null}
          {dirty ? (
            <button type="button" className={secondaryButton} onClick={discard} disabled={pending}>
              Vazgeç
            </button>
          ) : null}
          <button type="button" className={primaryButton} onClick={save} disabled={pending || !dirty}>
            <Save className="size-3.5" aria-hidden="true" />
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>

      {definition.related?.length ? (
        <div className={cn(card, "flex flex-wrap items-center gap-2 px-4 py-3 text-sm text-brand-muted")}>
          <span>Bu sayfada ayrıca:</span>
          {definition.related.map((link) => (
            <Link key={link.href} href={link.href} className="font-semibold text-brand-primary hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div key={revision} className="space-y-4">
        {definition.sections.filter((section) => section.base !== "seo").map((section, index) => (
          <EditorSection
            key={section.id}
            id={`section-${section.id}`}
            title={section.title}
            description={section.description}
            defaultOpen={index === 0}
          >
            <div className="grid gap-5 md:grid-cols-2">
              {section.fields.map((field) => {
                const wide = field.kind !== "text" && field.kind !== "date" && field.kind !== "url" && field.kind !== "select";
                return (
                  <div key={field.key} className={wide ? "md:col-span-2" : undefined}>
                    <FieldInput field={field} path={joinPath(section.base, field.key)} data={data} setData={setData} />
                  </div>
                );
              })}
            </div>
          </EditorSection>
        ))}
      </div>

      {definition.hasSeo ? (
        <div className={cn(card, "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-brand-muted")}>
          <span>Bu sayfanın Google başlığı ve açıklaması SEO ekranından yönetilir.</span>
          <Link href={`/manage/seo?item=page:${pageKey}`} className="font-semibold text-brand-primary hover:underline">
            SEO ayarlarını aç
          </Link>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="button" className={dangerLinkButton} onClick={reset} disabled={pending}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Sayfayı ilk hâline döndür
        </button>
      </div>
    </div>
  );
}
