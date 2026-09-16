"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Languages, Loader2, X } from "lucide-react";
import { exportTranslationAction, importTranslationAction } from "@/app/manage/(panel)/translation-actions";
import { repairAiJsonText } from "@/lib/content-model/ai-json";
import { fieldHint, fieldLabel, primaryButton, secondaryButton } from "./ui";

/**
 * Turkish is the source of truth; Global English is produced by handing one
 * prompt to an external model and pasting its JSON back. Nothing here calls
 * an LLM API.
 *
 * This is the single prompt every assistant instance uses. It preserves
 * payload structure and prevents chat UIs from auto-linkifying e-mails or
 * URLs into markdown that would corrupt the JSON.
 */
function buildPrompt(bundle: string): string {
  return [
    "Aşağıdaki JSON, bir kurumsal web sitesindeki içeriğin Türkçe kaynağıdır.",
    "Bu içeriği Global site için doğal ve profesyonel İngilizceye (en) çevir.",
    "",
    "ÇIKTI BİÇİMİ (zorunlu):",
    "1. Cevabın SADECE tek bir ```json kod bloğu olsun. Blok dışında selamlama, açıklama, not YAZMA.",
    "2. Kök yapı tam olarak: {\"translations\":{\"en\":{...}}}",
    "3. Her dilin gövdesi kaynak JSON ile birebir aynı alan yapısına sahip olsun; alan adlarını (key) çevirme, alan ekleme/çıkarma yapma, `null` olanları `null` bırak.",
    "",
    "BAĞLANTI VE E-POSTA (en sık yapılan hata):",
    "4. Hiçbir değeri markdown bağlantısına çevirme. `[metin](mailto:...)`, `[metin](https://...)` veya köşeli parantez/parantez kombinasyonu KESİNLİKLE olmasın.",
    "5. E-posta, telefon ve URL değerleri düz metin ve kaynaktakiyle birebir aynı olsun.",
    "   YANLIŞ: \"email\": \"[info@ornek.com](mailto:info@ornek.com)\"",
    "   DOĞRU:  \"email\": \"info@ornek.com\"",
    "   YANLIŞ: \"linkedin\": \"[https://linkedin.com/in/x](https://linkedin.com/in/x)\"",
    "   DOĞRU:  \"linkedin\": \"https://linkedin.com/in/x\"",
    "6. URL'lerde yüzde kodlaması (%22, %7B gibi) kullanma.",
    "",
    "DEĞİŞMEYECEK ALANLAR:",
    "7. `slug` kaynaktakiyle birebir aynı kalsın (adres dile göre değişmez, URL'de dil ön eki zaten var).",
    "8. `assetId`, `imageAssetId`, `coverImageAssetId`, `galleryAssetIds`, `avatarAssetId`, `iconAssetId`, `icon`, `bgColor`, `href`, `url` değerlerini olduğu gibi kopyala.",
    "9. HTML etiketlerini, sıralarını ve özniteliklerini koru; yalnızca etiketler arasındaki metni çevir.",
    "10. İçeriği özetleme veya kısaltma; her paragrafı, liste öğesini ve içerik bloğunu eksiksiz çevir. Dizi uzunlukları ve blok sıraları kaynakla birebir aynı kalsın.",
    "",
    "DİL:",
    "11. Kişi ve marka adlarını değiştirme; unvanları, görevleri ve genel teknik nitelemeleri doğal İngilizceye çevir.",
    "12. Teknoloji ve ürün adlarını (Flutter, React, Node.js, TypeScript, PostgreSQL, Docker gibi) kaynaktaki yazımıyla koru.",
    "",
    "SEO ALANLARI:",
    "13. `seoTitle`, `seoDescription`, `title`, `description`, `banner`, `subtitle` gibi tüm metin alanlarını İngilizceye çevir.",
    "14. SEO metinleri doğal ve arama dostu olsun; kelime kelime çeviri şart değil, anlam eksiksiz korunmalı.",
    "",
    "Kaynak (Türkçe) içerik:",
    bundle,
  ].join("\n");
}

export type TranslationAssistantProps = Readonly<{
  /** Entity-backed editors (collections, About, site settings). */
  entityId?: string;
  /** Dictionary-backed editors (page copy) supply the source themselves and
   * apply the result their own way - there is no revision to write to. */
  source?: unknown;
  onApply?: (translations: Record<string, unknown>) => Promise<{ error?: string; success?: string }>;
}>;

export function TranslationAssistant({ entityId, source, onApply }: TranslationAssistantProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const openDialog = async () => {
    setOpen(true);
    setMessage(null);
    setCopied(false);

    if (onApply) {
      setPrompt(buildPrompt(JSON.stringify({ sourceLocale: "tr", sourcePayload: source }, null, 2)));
      return;
    }
    if (prompt || !entityId) return;
    setLoading(true);
    const result = await exportTranslationAction(entityId);
    setLoading(false);
    if (result.error || !result.payloadJson) {
      setMessage({ kind: "error", text: result.error ?? "Türkçe içerik bulunamadı; önce TR sekmesinde Kaydet deyin." });
      return;
    }
    setPrompt(buildPrompt(result.payloadJson));
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const runImport = async () => {
    setImporting(true);
    setMessage(null);

    if (onApply) {
      let parsed: { translations?: Record<string, unknown> } | null = null;
      try {
        parsed = JSON.parse(repairAiJsonText(pasted)) as { translations?: Record<string, unknown> };
      } catch {
        setImporting(false);
        setMessage({ kind: "error", text: "JSON okunamadı. Yapay zekânın çıktısını olduğu gibi yapıştırın." });
        return;
      }
      const result = await onApply(parsed.translations ?? (parsed as Record<string, unknown>));
      setImporting(false);
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setMessage({ kind: "success", text: result.success ?? "Çeviriler kaydedildi." });
      setPasted("");
      router.refresh();
      return;
    }

    const formData = new FormData();
    formData.set("entityId", entityId ?? "");
    formData.set("translationsJson", pasted);
    const result = await importTranslationAction({}, formData);
    setImporting(false);
    if (result.error) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "success", text: result.success ?? "Çeviriler kaydedildi ve yayına alındı." });
    setPasted("");
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={openDialog} className={secondaryButton}>
        <Languages className="size-3.5" aria-hidden="true" />
        Yapay zekâ ile çevir
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Yapay zekâ ile çeviri"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-brand-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-brand-text">Yapay zekâ ile çevir</h2>
                <p className="text-xs text-brand-muted">
                  Promptu kopyalayın, yapay zekâya verin, dönen JSON&apos;u aşağıya yapıştırın. Global İngilizce kaydedilip yayına alınır.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="rounded-lg p-2 text-brand-muted hover:bg-brand-page hover:text-brand-text"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className={fieldLabel}>1. Promptu kopyalayın</span>
                  <button type="button" onClick={copyPrompt} disabled={!prompt} className={secondaryButton}>
                    {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
                <textarea
                  value={loading ? "Türkçe içerik hazırlanıyor…" : prompt}
                  readOnly
                  rows={10}
                  className="w-full rounded-lg border border-brand-border bg-brand-page p-3 font-mono text-xs text-brand-text"
                />
              </div>

              <div className="space-y-2">
                <span className={fieldLabel}>2. Yapay zekânın verdiği JSON&apos;u yapıştırın</span>
                <textarea
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  rows={8}
                  placeholder={'{"translations":{"en":{…}}}'}
                  className="w-full rounded-lg border border-brand-border bg-brand-surface p-3 font-mono text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-primary focus:outline-none"
                />
                <p className={fieldHint}>
                  İçe aktarma Global İngilizce içeriği kaydedip yayına alır; sonrasında elle düzenleyebilirsiniz.
                </p>
              </div>

              {message ? (
                <p
                  role={message.kind === "error" ? "alert" : "status"}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    message.kind === "error"
                      ? "border border-brand-danger/30 bg-brand-danger/5 text-brand-danger"
                      : "border border-brand-success/30 bg-brand-success/5 text-brand-success"
                  }`}
                >
                  {message.text}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-brand-border px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                Kapat
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={importing || pasted.trim().length === 0}
                className={primaryButton}
              >
                {importing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                {importing ? "İçe aktarılıyor…" : "JSON'u içe aktar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
