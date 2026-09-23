"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorSection } from "@/components/admin/EditorSection";
import { useToast } from "@/components/admin/Toast";
import { card, checkboxInput, cn, dangerLinkButton, fieldHint, fieldInput, fieldLabel, fieldTextarea, primaryButton } from "@/components/admin/ui";
import type { AdminAnnouncementRow } from "@/lib/kadik-content/collections";
import { deleteAnnouncementAction, saveAnnouncementAction } from "../kadik-collection-actions";

type Form = { title: string; text: string; date: string; linkUrl: string; linkLabel: string; published: boolean };

const initial = (item: AdminAnnouncementRow | null): Form => ({
  title: item?.title ?? "",
  text: item?.text ?? "",
  date: item?.date ?? "",
  linkUrl: item?.linkUrl ?? "",
  linkLabel: item?.linkLabel ?? "",
  published: item?.published ?? true,
});

export function AnnouncementEditor({ item }: { item: AdminAnnouncementRow | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(() => initial(item));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial(item)));
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startTransition(async () => {
      const result = await saveAnnouncementAction(item?.id ?? null, form);
      toast(result.message, result.ok ? "success" : "error");
      if (!result.ok) return;
      setBaseline(JSON.stringify(form));
      if (!item && result.id) router.replace(`/manage/announcements/${result.id}`);
      else router.refresh();
    });

  const remove = () => {
    if (!item || !window.confirm(`"${item.title}" duyurusu kalıcı olarak silinsin mi?`)) return;
    startTransition(async () => {
      const result = await deleteAnnouncementAction(item.id);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setBaseline(JSON.stringify(form));
        router.push("/manage/announcements");
      }
    });
  };

  return (
    <EditorPageLayout
      main={
        <EditorSection id="announcement" title="Duyuru" description="Duyurular sayfasında bir kart olarak görünür." defaultOpen>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={fieldLabel} htmlFor="ann-title">Başlık *</label>
              <input id="ann-title" className={fieldInput} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
            </div>
            <div className="md:col-span-2">
              <label className={fieldLabel} htmlFor="ann-text">Metin</label>
              <textarea id="ann-text" className={fieldTextarea} rows={5} value={form.text} onChange={(e) => set("text", e.target.value)} maxLength={5000} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ann-date">Tarih</label>
              <input id="ann-date" type="date" className={fieldInput} value={form.date} onChange={(e) => set("date", e.target.value)} />
              <span className={fieldHint}>İsteğe bağlı; doluysa kartta gösterilir.</span>
            </div>
            <div />
            <div>
              <label className={fieldLabel} htmlFor="ann-link">Bağlantı</label>
              <input id="ann-link" className={fieldInput} inputMode="url" placeholder="https:// ya da /events" value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} />
              <span className={fieldHint}>Boşsa kart İletişim sayfasına gider.</span>
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ann-link-label">Bağlantı yazısı</label>
              <input id="ann-link-label" className={fieldInput} placeholder="Learn more ↗" value={form.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} maxLength={80} />
            </div>
          </div>
        </EditorSection>
      }
      aside={
        <div className={cn(card, "space-y-4 p-5")}>
          <label className="flex items-center gap-2 text-sm font-semibold text-brand-text">
            <input type="checkbox" className={checkboxInput} checked={form.published} onChange={(e) => set("published", e.target.checked)} />
            Sitede yayında
          </label>
          {dirty ? <p className="text-xs font-bold text-brand-warning">Kaydedilmemiş değişiklik var</p> : null}
          <button type="button" className={cn(primaryButton, "w-full")} onClick={save} disabled={pending || !dirty}>
            <Save className="size-3.5" aria-hidden="true" />
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {item ? (
            <button type="button" className={cn(dangerLinkButton, "w-full")} onClick={remove} disabled={pending}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Duyuruyu sil
            </button>
          ) : null}
        </div>
      }
    />
  );
}
