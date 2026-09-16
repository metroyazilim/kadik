# Spec 10 — TR Kaynaktan Prompt/JSON Dışa Aktarma ve Atomik Çoklu Dil İçe Aktarma

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-10 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 8 ve Spec 9 tamamlanmış olmalıdır  
**Paralellik:** Spec 13 ile farklı dosya sahipliği sağlanırsa paralel olabilir; page/section editörleri bu birimin sahibindedir

## 1. Hedef

Yönetici Türkçe içeriği kaydettikten sonra tek tıkla:

1. Model talimatını kopyalar.
2. İçeriğin makine tarafından anlaşılır, sürümlü JSON paketini kopyalar.
3. Harici modele prompt + JSON gönderir.
4. Modelin tek JSON yanıtını yönetim paneline yapıştırır.
5. EN, RU ve AR çevirilerini önizler.
6. Tek onayla üç locale'e atomik olarak dağıtır.

Bu sistem bir LLM servisine bağlanmaz, API anahtarı istemez ve sunucu tarafında model çağrısı yapmaz. Kullanıcı istediği modele manuel taşıma yapar.

## 2. Ürün Kararları

- Kaynak locale V1'de yalnız `tr`'dir.
- Hedefler tam set olarak `en`, `ru`, `ar`'dır. Import paketinin bir locale'i eksikse apply edilmez.
- Import yalnız **taslak** revizyonlar üretir; hiçbir dili otomatik yayınlamaz.
- JSON dışa aktarma yalnız section registry'nin `localizablePaths` alanlarını içerir. ID, media ID, route kimliği, component kind, placement key ve non-localized settings çevrilmez.
- Kaynak TR revizyonu export sonrası değişirse eski model cevabı uygulanmaz. Kullanıcı yeni paket üretir.
- Üç locale'den biri doğrulamada başarısızsa hiçbir locale yazılmaz.

## 3. UI Akışı

### 3.1 Giriş noktası

Page Builder ve koleksiyon editörlerinde TR locale aktifken sağ panelde “Çevirileri hazırla” kartı görünür.

Durumlar:

- TR taslağı yok: düğme disabled, açıklama “Önce Türkçe taslağı kaydedin.”
- Kaydedilmemiş local değişiklik: export disabled, açıklama “Dışa aktarmadan önce taslağı kaydedin.”
- Geçerli TR taslağı: “Prompt'u kopyala” ve “JSON'u kopyala” düğmeleri.
- Hedef locale'lerde mevcut taslak varsa import öncesi açık overwrite özeti.

### 3.2 Import paneli

- Büyük ama kod editörü olmayan monospace textarea: “Model yanıtını buraya yapıştırın”.
- “Doğrula ve önizle” server action'ı; yapıştırma anında DB yazılmaz.
- Sonuç tablosu satır bazında field path, TR kaynak ve EN/RU/AR hedef özetini gösterir.
- Hatalar locale + section + field path ile gösterilir.
- Başarılı preflight sonrası “3 dili taslak olarak içe aktar” düğmesi.
- Apply sonucu tek batch toast ve locale status güncellemesi.
- Kullanıcıya public'in değişmediği, her dilin ayrıca yayınlanması gerektiği söylenir.

## 4. Export Envelope

Kanonik JSON, deterministic key order ile üretilir:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-08T12:00:00.000Z",
  "source": {
    "locale": "tr",
    "scope": "managed-page",
    "entityId": "...",
    "entityVersion": 4,
    "draftRevisionId": "...",
    "pageId": "...",
    "pageLayoutDraftRevisionId": "..."
  },
  "targetLocales": ["en", "ru", "ar"],
  "content": {
    "page": {
      "title": "...",
      "description": "...",
      "slug": "..."
    },
    "sections": [
      {
        "placementKey": "...",
        "sectionId": "...",
        "kind": "hero",
        "sectionSchemaVersion": 1,
        "fields": {
          "eyebrow": "...",
          "title": "...",
          "description": "..."
        }
      }
    ]
  },
  "constraints": {
    "preserve": ["entityId", "sectionId", "placementKey", "kind", "sectionSchemaVersion"],
    "format": "json-only"
  }
}
```

Koleksiyon kaydı için `scope`, `entityId`, `contentType`, `draftRevisionId` ve registry'nin localizable field ağacı kullanılır; page/layout alanları bulunmaz.

### 4.1 Dahil edilen alanlar

- Düz metin ve textarea alanları.
- Tiptap JSON içindeki yalnız text node değerleri; node type/attrs/link href korunur.
- Tekrarlanan item'larda stabil `itemKey`; sıra ve key korunur, yalnız localizable değerler çevrilir.
- Locale slug.
- Media usage alt/caption locale alanları.
- Açıkça yazılmış SEO override metinleri varsa Spec 11 registry kurallarına göre; otomatik türetilen değer export edilmez.

### 4.2 Hariç alanlar

- Asset IDs/URLs/checksum/objectKey.
- Internal admin name/key.
- Section kind, schemaVersion, placement settings, content type.
- CTA URL hedefi; yalnız etiketi çevrilir. Locale route'a dönüşmesi gereken internal link ayrı route token'ı olarak korunur ve import resolver hedef locale path'i üretir.
- Tarih, numeric limit, boolean, order.
- HTML/script/style.

## 5. Prompt Kontratı

“Prompt'u kopyala” çıktısı kısa fakat kesin olmalıdır:

- Rol: profesyonel kurumsal yazılım sitesi çevirmeni.
- Kaynak Türkçe; hedef EN/RU/AR.
- Marka adları, ürün adları, ID'ler, URL'ler, sayılar ve JSON key'leri korunur.
- Anlam ve CTA niyeti korunur; kelime kelime yapay çeviri yapılmaz.
- İngilizce/Rusça/Arapça doğal kurumsal ton.
- Arapçada RTL metin üretilir fakat JSON yapısı LTR anahtarlarını korur.
- Tiptap node yapısı ve placeholder/token'lar korunur.
- Yalnız aşağıdaki response schema'sına uyan JSON döndür; Markdown fence, açıklama, yorum yok.
- Eksik alan uydurma; source value boşsa hedef de boş.

Prompt response schema örneğini içerir fakat gerçek source içeriği ayrı JSON düğmesinden gelir. “Prompt + JSON'u birlikte kopyala” üçüncü kolaylık düğmesi MAY eklenebilir; iki zorunlu düğmenin yerini almaz.

## 6. Import Response Schema

```json
{
  "schemaVersion": 1,
  "sourceDraftRevisionId": "...",
  "translations": {
    "en": { "page": {}, "sections": [] },
    "ru": { "page": {}, "sections": [] },
    "ar": { "page": {}, "sections": [] }
  }
}
```

Zorunlu doğrulamalar:

1. Root object ve `schemaVersion=1`.
2. Locale seti tam olarak `en`, `ru`, `ar`; ekstra locale reddedilir.
3. `sourceDraftRevisionId` mevcut TR draft pointer'ı ile eşit.
4. Page/section/item stabil kimlik seti export ile birebir aynı; eksik, fazla, duplicate yok.
5. Her kind payload'ı hedef locale için section registry Zod schema'sından geçer.
6. Korunan alanlar source ile deep-equal.
7. Tiptap node/mark/attrs yapısı source ile uyumludur; yeni link/script/embed eklenemez.
8. Slug normalize edilir, boş/duplicate/collision kontrolü üç locale için preflight edilir.
9. String ve toplam paket boyutu sınırları uygulanır.
10. Rich text sanitize sonucu güvenlidir; sanitization içeriği anlamlı biçimde değiştiriyorsa sessizce kabul yerine hata verir.

Textarea yardımcı olarak baştaki/sondaki tek Markdown code fence'i çıkarabilir; prose, birden fazla blok veya trailing garbage kabul edilmez.

## 7. Preflight ve Apply

### 7.1 Preflight

`prepareTranslationImport(context, rawJson)`:

- Parse + schema validate.
- Kaynak revision freshness.
- Entity/page/section ownership kontrolü; başka sayfanın ID'si enjekte edilemez.
- Hedef mevcut draft version'larını okur.
- Route collision ve media reference kontrolü.
- Diff üretir: oluşturulacak/değiştirilecek hedef draftlar, mevcut draft overwrite uyarıları.
- Kısa ömürlü imzalı `importPlanToken` döndürür. Token user ID, source revision, hedef translation versions ve normalized payload hash içerir; raw payload cookie'ye yazılmaz.

### 7.2 Apply

`applyTranslationImport(context, normalizedPayload, importPlanToken)`:

- Token signature/expiry/user/source hash kontrolü.
- Hedef expected versions hâlâ aynı mı tekrar kontrol.
- Tek Prisma transaction içinde EN/RU/AR için immutable draft revisions oluşturur ve üç pointer'ı ilerletir.
- Page scope ise ilgili section draftları ve page-level revision aynı transaction'da yazılır.
- MediaUsage locale kayıtları senkronize edilir.
- Tek batch audit root olayı ve locale başına detay metadata'sı üretir.
- Hiçbir published pointer'a dokunmaz.
- Başarısızlıkta 0 target locale değişmiş olur.

Payload büyükse transaction sınırı içinde bounded insert yapılır; locale başına ayrı server action yasaktır.

## 8. Conflict ve Overwrite Politikası

- Hedef locale boşsa doğrudan yeni draft.
- Hedef locale'de draft varsa preflight diff “üzerine yazılacak” gösterir ve explicit checkbox ister.
- Hedef draft preflight sonrası değişirse apply `409 stale target` döndürür; otomatik merge yapmaz.
- TR source değişirse `409 stale source`; yeni prompt/JSON gerekir.
- Published hedefe doğrudan overwrite yoktur; yalnız draft pointer değişir.
- Import edilmiş draft kullanıcı tarafından normal editörde düzeltilebilir.

## 9. Güvenlik ve Gizlilik

- Export yalnız yetkili kullanıcının düzenleyebildiği entity için üretilebilir.
- AUTHOR rolü yalnız kendi yetki alanındaki post/medya içeriklerini export/import eder; Page Builder erişimi yoktur.
- Secret, admin email, audit metadata, internal storage URL/objectKey pakete girmez.
- Clipboard browser tarafında yalnız kullanıcı tıklamasıyla yazılır; başarısızlık açıkça gösterilir.
- Raw model cevabı audit'e veya application log'a tam içerik olarak yazılmaz. Hash, byte size, source revision ve locale sonucu yeterlidir.
- JSON parse/validation server tarafında zorunludur; client preview güven sınırı değildir.

## 10. Dosya Sahipliği

- `lib/content-model/translation-package.ts` (yeni)
- `lib/content-model/translation-import.ts` (yeni)
- `lib/content-model/*-registry.ts` localizable metadata adaptörleri
- `components/admin/TranslationTransferPanel.tsx` (yeni)
- Page Builder ve koleksiyon editor entegrasyon noktaları
- İlgili route `actions.ts`
- Tiptap safe translation traversal helper

Prisma şemasına yeni kalıcı tablo eklenmesi beklenmez; immutable revisions + AuditLog kullanılır. Plan token için DB tablo eklenmez, signed kısa ömürlü token tercih edilir.

## 11. Kabul Kriterleri

1. **AC-10.1** Kaydedilmemiş veya TR draft'ı olmayan içerikte export yapılamaz; neden UI'da görünür.
2. **AC-10.2** Prompt ve JSON ayrı düğmelerle clipboard'a kopyalanır; JSON deterministic ve `schemaVersion=1` taşır.
3. **AC-10.3** Export yalnız registry localizable alanlarını içerir; asset ID, URL, placement key ve node yapısı çevrilemez biçimde korunur.
4. **AC-10.4** Geçerli tek model cevabı EN/RU/AR önizlemesini üretir ve tek onayla üç draft'ı yazar.
5. **AC-10.5** Bir locale'de eksik/bozuk alan varsa hiçbir locale yazılmaz.
6. **AC-10.6** Export sonrası TR draft değişirse eski response uygulanmaz.
7. **AC-10.7** Preflight sonrası bir hedef draft değişirse apply onu ezmez; kullanıcı yeni preflight yapar.
8. **AC-10.8** Import published pointer'ları değiştirmez; public EN/RU/AR ancak ayrı publish sonrası değişir.
9. **AC-10.9** Tiptap yapısı, internal link token'ları, media IDs ve item keys round-trip'te birebir korunur.
10. **AC-10.10** Arapça imported content normal editör/public preview'da `dir="rtl"` altında doğru görünür; JSON key'leri değişmez.
11. **AC-10.11** Import audit kaydı source revision, hedef locale'ler, payload hash ve sonucu içerir; raw içerik/secret içermez.
12. **AC-10.12** Aynı valid response token'ı ikinci kez uygulanamaz veya idempotent no-op olur; duplicate revisions üretmez.

## 12. Test ve Doğrulama

### Kalıcı testler

- Export deterministic snapshot değil, semantic object assertions.
- Preserve field tamper rejection.
- Missing/extra locale rejection.
- Stale source/target conflict.
- Atomic rollback: RU validation/DB failure simülasyonunda EN/AR değişmemeli.
- Tiptap structural traversal ve malicious link/script rejection.
- Duplicate apply.

### Gerçek tarayıcı senaryosu

1. TR bir test sayfası/section'ı kaydet.
2. Prompt ve JSON clipboard çıktısını yakala.
3. Fixture geçerli model response'unu import textarea'ya yapıştır.
4. Üç locale diff preview'ını gör; apply et.
5. EN/RU/AR editörlerinde draft değerleri doğrula; public'in değişmediğini gör.
6. Her locale'i ayrı yayınla ve public metinleri/RTL'yi doğrula.
7. Eski source revision response'unu tekrar dene ve stale hatasını gör.
8. Test verisini temizle.

### Komutlar

- `npx tsc --noEmit`
- `npx eslint .`
- ilgili integration/E2E testleri
- `npm run build`

## 13. Riskler

- **Model JSON dışı metin döndürür:** yalnız tek fence toleransı; belirsiz düzeltme/regex yok.
- **Partial import:** locale başına ayrı mutation yasak, tek transaction.
- **Kimlik çevirisi:** preserve set deep equality ile korunur.
- **Eski response veri ezer:** source + target optimistic versions token'a bağlanır.
- **Prompt şişmesi:** yalnız localizable alanlar ve deterministic compact JSON; medya binary/metadata yok.
- **Otomatik yayın:** özellikle yasak; insan incelemesi ve locale publish zorunlu.

## 14. Definition of Done

- Page ve koleksiyon içeriklerinde TR→EN/RU/AR manuel model köprüsü çalışır.
- Bir yapıştırma üç hedef locale'e atomik, taslak-only ve conflict-safe dağıtılır.
- Kimlik/media/structured rich-text korunumu testlerle kanıtlanır.
- Browser'da import, preview, publish ve Arapça RTL akışı doğrulanır.
- Typecheck, lint, ilgili testler ve build geçer.
- `project-overview.md`, `architecture.md` ve `progress-tracker.md` uygulanmış duruma göre güncellenir.
