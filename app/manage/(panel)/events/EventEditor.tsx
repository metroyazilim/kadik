"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { EditorSection } from "@/components/admin/EditorSection";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { useToast } from "@/components/admin/Toast";
import { card, checkboxInput, cn, dangerLinkButton, fieldHint, fieldInput, fieldLabel, primaryButton, secondaryButton } from "@/components/admin/ui";
import type { AdminEventRow } from "@/lib/kadik-content/collections";
import { deleteEventAction, saveEventAction } from "../kadik-collection-actions";

type Form = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  published: boolean;
};

function initial(event: AdminEventRow | null): Form {
  return {
    title: event?.title ?? "",
    date: event?.date ?? "",
    startTime: event?.startTime ?? "",
    endTime: event?.endTime ?? "",
    location: event?.location ?? "",
    description: event?.description ?? "",
    published: event?.published ?? true,
  };
}

export function EventEditor({ event }: { event: AdminEventRow | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(() => initial(event));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial(event)));
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
      const result = await saveEventAction(event?.id ?? null, {
        title: form.title,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        description: form.description,
        published: form.published,
      });
      toast(result.message, result.ok ? "success" : "error");
      if (!result.ok) return;
      setBaseline(JSON.stringify(form));
      if (!event && result.id) router.replace(`/manage/events/${result.id}`);
      else router.refresh();
    });

  const remove = () => {
    if (!event || !window.confirm(`"${event.title}" etkinliği kalıcı olarak silinsin mi?`)) return;
    startTransition(async () => {
      const result = await deleteEventAction(event.id);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setBaseline(JSON.stringify(form));
        router.push("/manage/events");
      }
    });
  };

  return (
    <EditorPageLayout
      main={
        <div className="space-y-4">
          <EditorSection id="event-basics" title="Temel bilgiler" description="Ad, tarih, saat ve yer; takvimde ve etkinlik penceresinde görünür." defaultOpen>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={fieldLabel} htmlFor="event-title">Etkinlik adı *</label>
                <input id="event-title" className={fieldInput} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="event-date">Tarih *</label>
                <input id="event-date" type="date" className={fieldInput} value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel} htmlFor="event-start">Başlangıç</label>
                  <input id="event-start" type="time" className={fieldInput} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="event-end">Bitiş</label>
                  <input id="event-end" type="time" className={fieldInput} value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={fieldLabel} htmlFor="event-location">Yer</label>
                <input id="event-location" className={fieldInput} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="ör. The Royal Society, London" maxLength={300} />
              </div>
            </div>
          </EditorSection>

          <EditorSection id="event-description" title="Açıklama" description="Etkinlik penceresinde ve ziyaretçiye giden e-postada gösterilir." defaultOpen>
            <RichTextEditor label="Açıklama" value={form.description} onChange={(value) => set("description", value)} maxLength={20000} />
          </EditorSection>

        </div>
      }
      aside={
        <div className={cn(card, "space-y-4 p-5")}>
          <label className="flex items-center gap-2 text-sm font-semibold text-brand-text">
            <input type="checkbox" className={checkboxInput} checked={form.published} onChange={(e) => set("published", e.target.checked)} />
            Sitede yayında
          </label>
          <p className={fieldHint}>İşareti kaldırırsanız etkinlik sitede görünmez ama silinmez.</p>
          {dirty ? <p className="text-xs font-bold text-brand-warning">Kaydedilmemiş değişiklik var</p> : null}
          <button type="button" className={cn(primaryButton, "w-full")} onClick={save} disabled={pending || !dirty}>
            <Save className="size-3.5" aria-hidden="true" />
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {event ? (
            <a href={`/events?event=${encodeURIComponent(event.id)}`} target="_blank" rel="noopener noreferrer" className={cn(secondaryButton, "w-full")}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Sitede gör
            </a>
          ) : null}
          {event ? (
            <button type="button" className={cn(dangerLinkButton, "w-full")} onClick={remove} disabled={pending}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Etkinliği sil
            </button>
          ) : null}
        </div>
      }
    />
  );
}
