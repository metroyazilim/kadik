# Spec 11 — Otomatik SEO Türetimi, Gelişmiş Override ve Route SEO Merkezi

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-11 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 8 ve Spec 9 tamamlanmış olmalıdır  
**Paralellik:** Tek başına uygulanır; SEO payload kontratı, route metadata ve `/manage/seo` tek sahibidir

## 1. Problem

Mevcut `/manage/seo` yüzeyi bulgu/denetim listesi sunuyor; route seçip metadata düzenlemeye izin vermiyor. Koleksiyon ve About editörlerinde başlık/açıklama elle giriliyor, fakat içeriğin başlık/özet/görsellerinden güvenli varsayılanlar sistematik türetilmiyor. Keywords, canonical override, sosyal paylaşım, robots, image alt ve structured data için ortak kontrat yok.

## 2. Hedef ve Görünür Sonuç

- Kullanıcı içerik başlığı, özeti ve görsellerini düzenlerken SEO önizlemesi anında güncellenir.
- SEO için normal durumda ayrıca alan doldurmak gerekmez; sistem deterministik varsayılan üretir.
- “Gelişmiş SEO” accordion'u explicit override sağlar.
- `/manage/seo` referans görseldeki gibi solda bütün gerçek public route'ları, sağda SERP preview + alan editörü gösterir.
- SEO Audit korunur fakat editörün ayrı sekmesi/filtre modu olur; bulgu listesi kaybolmaz.
- Public metadata yalnız yayınlanmış revision'dan üretilir; admin form değişikliği otomatik publish yapmaz.

## 3. Kapsam

### Kapsam içi

- Page, collection detail/index ve statik route metadata kaynaklarının tek resolver'a bağlanması.
- Otomatik title/description/keywords/OG/schema üretimi.
- Explicit advanced overrides.
- Route listesi, arama/filtre, SERP/social preview, edit/save/publish navigation.
- Locale başına canonical/hreflang/robots.
- MediaUsage bazlı alt text düzenleme bağlantısı.
- Mevcut audit bulgularının yeni override alanlarına göre güncellenmesi.

### Kapsam dışı

- Harici SEO skor servisi, Search Console, keyword volume veya AI üretimi.
- İçeriği otomatik yayınlamak.
- Public sayfa görsel tasarımı.
- Redirect yönetim merkezi; route slug publish mevcut ContentRoute kurallarında kalır.

## 4. Tek SEO Kontratı

Her locale revision payload'ında ortak optional `seo` nesnesi bulunur:

```ts
type SeoOverrides = {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  robots?: {
    index?: boolean;
    follow?: boolean;
  };
  openGraph?: {
    title?: string;
    description?: string;
    imageAssetId?: string;
  };
  twitter?: {
    card?: "summary" | "summary_large_image";
    title?: string;
    description?: string;
    imageAssetId?: string;
  };
  structuredData?: {
    mode: "auto" | "custom" | "disabled";
    customJsonLd?: unknown;
  };
};
```

Kurallar:

- Boş string override sayılmaz; normalize edilip kaldırılır.
- `keywords` trim + case-insensitive dedupe, bounded count/length.
- `canonical` relative path veya `NEXT_PUBLIC_SITE_URL` ile aynı origin absolute URL olabilir. Dış origin reddedilir.
- OG/Twitter görselleri `MediaAsset` ID'sidir; dış URL yoktur.
- Custom JSON-LD object veya object array olmalıdır; `<script>`, string HTML, prototype keys ve aşırı derinlik/boyut reddedilir.
- Schema override user payload'ını otomatik schema ile kör birleştirmez. `auto`, `custom`, `disabled` açık modlardır.
- Bu contract page/section/collection registry şemalarındaki tekrar eden SEO alanlarının yerini alır; compatibility alias bırakılmaz.

## 5. Otomatik Türetim Sırası

`resolveSeoDraftPreview` ve `resolvePublishedSeo` aynı saf karar fonksiyonunu kullanır; girdinin draft/published seçimi dışarıda yapılır.

### 5.1 Title

1. `seo.title` explicit override.
2. İçerik/page public title.
3. İlk uygun hero/page-banner title.
4. Site default title.

Site adı suffix'i template ile bir kez eklenir. Override zaten site adını içeriyorsa tekrar eklenmez. Locale başına template Site Settings `defaultSeo` alanından gelir.

### 5.2 Description

1. `seo.description`.
2. İçerik `summary`/`description`.
3. İlk uygun section intro veya sanitized rich-text'ten ilk anlamlı paragraf.
4. Site default description.

HTML/Tiptap düz metne çevrilir, whitespace normalize edilir, kelime ortasında kesmeden SERP preview sınırında kısaltılır. Saklanan içerik değiştirilmez; yalnız resolved metadata.

### 5.3 Keywords

1. Explicit `seo.keywords`.
2. İçerik category/tag/technology alanları.
3. Page/collection type'a ait registry sabitleri.

Body'den otomatik “keyword stuffing” yapılmaz. Keywords meta tag modern arama motorları için sınırlı değere sahiptir; kullanıcı istediği için desteklenir fakat kalite skoru ana sinyal saymaz.

### 5.4 Social

- Social title/description override yoksa resolved SEO title/description.
- Görsel: explicit social asset → içerik featured/hero asset → Site Settings default OG asset.
- Asset missing/archived/storageStatus MISSING ise fallback ve audit finding.

### 5.5 Structured data

Auto mod:

- Home/organization: `Organization` + `WebSite`.
- Static page: `WebPage`/`AboutPage`/`ContactPage` registry kind'ına göre.
- Blog detail: `BlogPosting`, gerçek author, published/modified date, image.
- Service detail: `Service`.
- FAQ: yalnız ekranda yayınlanmış gerçek soru/cevaplardan `FAQPage`.
- Breadcrumb: ContentRoute/locale registry'den `BreadcrumbList`.

Auto schema görünür içerikte olmayan rating/review/address uydurmaz.

## 6. Image Alt Text

Alt metin SEO override nesnesine kopyalanmaz. Tek gerçek kaynak:

1. Locale-specific `MediaUsage.altText` varsa o.
2. `MediaAsset.altText` global fallback.
3. Dekoratif olarak işaretlenmiş kullanımda empty alt.
4. Hiçbiri yoksa audit finding; filename otomatik alt yapılmaz.

Gelişmiş SEO paneli sayfadaki medya usages listesini gösterir ve ilgili locale usage alt/caption alanlarını düzenler. Bir asset'in başka kullanımındaki alt metni yanlışlıkla değiştirmez.

## 7. SEO Center UI

Route: `/manage/seo?locale=tr&route=<contentRouteId-or-static-key>&tab=editor|audit`

### 7.1 Sol kolon

- Search: title/path.
- Locale selector TR/EN/RU/AR.
- Gruplar: Sayfalar, Koleksiyon İndeksleri, Hizmetler, Projeler, Blog Yazıları, Ekip, Yasal/Sistem.
- Her satır: title, path, durum ikonu ve finding sayısı.
- Durum: İyi / Uyarı / Eksik / Noindex / Taslak değişiklik.
- 50 kayıt cursor/page ile; yüzlerce route payload'sız listelenir.
- Seçim URL'de kalır; browser back/refresh çalışır.

Liste kaynağı hardcoded değildir: ManagedPage + ContentRoute registry + explicit static route registry birleşimidir. Draft-only ve henüz route'u olmayan kayıtlar ayrı “Taslaklar” grubunda geçici admin kimliğiyle listelenebilir.

### 7.2 Sağ kolon

1. Route heading, locale, public/open editor linkleri.
2. Google desktop/mobile SERP preview: favicon/site adı, canonical path, title, description.
3. Social card preview.
4. “Otomatik kaynaklar” kartı: title hangi field'dan, description hangi field'dan, image hangi asset'ten geldi.
5. “Gelişmiş SEO” accordion: title, description, keywords chip input, canonical, robots, OG/Twitter, structured data mode/editor.
6. Character/pixel-length yardımcıları uyarıdır; save engeli yalnız hard max veya invalid shape'tir.
7. “İçerik editöründe aç” linki. SEO Center kaynak içeriği kopyalamaz.

Reference `dr-murat-admin-ui/src/.../seo-screen.tsx` yalnız sol route listesi + sağ preview/edit hiyerarşisi için kullanılır; static `SEO_PAGES` ve local state üretime alınmaz.

### 7.3 Audit sekmesi

Mevcut `SeoAuditPanel` davranışı korunarak yeni resolver ile çalışır:

- eksik/çok kısa/çok uzun title ve description,
- canonical collision/invalid,
- missing hreflang counterpart,
- missing/broken OG image,
- missing usage alt,
- noindex + sitemap çelişkisi,
- invalid custom JSON-LD,
- route collision/orphan route,
- BlogPosting author eksikliği.

Finding satırı ilgili SEO editor route'una link verir.

## 8. Save ve Publish Semantiği

- SEO Center “Taslağı kaydet” hedef entity'nin aktif locale payload'ında yalnız `seo` alanına validated patch uygular ve yeni immutable draft revision yaratır.
- Mevcut içerik alanlarını server'da son draft'tan alır; browser'ın göndermediği field'ları silmez.
- Expected translation version zorunlu; eşzamanlı edit conflict verir.
- “Yayınla” isteğe bağlı doğrudan eylem değildir. Kullanıcı ilgili içerik editörüne yönlenir veya mevcut publish action aynı page içinde açık confirmation ile çağrılır. Karar: V1'de SEO Center save-only; public değişiklik normal locale publish akışından geçer.
- Otomatik preview input değiştikçe client-side saf resolver ile güncellenir; server save sonucu aynı resolver snapshot'ı ile karşılaştırılır.

## 9. Metadata ve Route Entegrasyonu

- `lib/public-seo.ts` tüm route'larda ortak `resolvePublishedSeo` kullanır.
- Route component'leri kendi title/description fallback zincirini yazmaz.
- Canonical path locale registry'den türetilir; explicit same-origin canonical ancak advanced override ile.
- Hreflang yalnız gerçekten published counterpart route'larını içerir; eksik locale uydurulmaz.
- Turkish prefixless invariant korunur.
- Sitemap yalnız indexable published routes içerir; `seo.robots.index=false` route'u sitemap'ten çıkarır.
- Metadata cache tag'i content publish, page layout publish, section publish, site default SEO publish ve author profile değişiminde hedefli invalidate edilir.

## 10. Dosya Sahipliği

- `lib/public-seo.ts`
- Yeni `lib/seo/**` resolver/registry/validation
- `lib/content-model/payload-validation.ts` ve content registry SEO contract migration'ı
- `app/manage/(panel)/seo/**`
- `components/admin/SeoEditorPanel.tsx`, `SeoRouteList.tsx`, `SerpPreview.tsx` (yeni veya temiz cutover)
- Public route `generateMetadata` adaptörleri
- Sitemap/robots metadata kaynakları

Media core ve profile/RBAC bu spec'te değiştirilmez; mevcut MediaUsage API kullanılır. Spec 12 blog author resolver'ı sonradan schema üretimine bağlar.

## 11. Migration

- Mevcut `seoTitle`, `seoDescription`, `ogImageAssetId` alanları registry migration ile yeni `seo` nesnesine taşınır.
- Aynı revision satırı mutate edilmez. Seed/backfill yeni draft/published-equivalent revision üretme planını açıklar; published içeriğin metadata'sı cutover anında değişmemelidir.
- Migration idempotent ve semantic parity raporlu olmalıdır.
- Eski alan okuyucuları ve alias'ları cutover sonrası silinir.

## 12. Kabul Kriterleri

1. **AC-11.1** `/manage/seo` sol route listesinde bütün published ContentRoute kayıtları ve ManagedPage/static route'lar locale bazında görünür.
2. **AC-11.2** Route seçimi URL'de kalır; sağ panel SERP ve social preview'ı gerçek resolved değerlerle gösterir.
3. **AC-11.3** İçerik title/summary değiştikçe explicit override yoksa preview otomatik güncellenir.
4. **AC-11.4** Explicit title/description/keywords/canonical/robots/social/schema alanları save sonrası draft payload'ta saklanır; public normal publish'e kadar değişmez.
5. **AC-11.5** Dış origin canonical, dış görsel URL, invalid/zararlı JSON-LD server tarafında reddedilir.
6. **AC-11.6** Metadata öncelik zinciri §5 ile bütün page/collection route'larda aynıdır; route-local fallback kopyaları yoktur.
7. **AC-11.7** Hreflang yalnız published locale route'larını gösterir; TR canonical prefixsizdir.
8. **AC-11.8** Alt metin locale MediaUsage → global MediaAsset → decorative sırasıyla çözülür; filename fallback yapılmaz.
9. **AC-11.9** BlogPosting/Service/FAQPage/Breadcrumb structured data yalnız gerçek yayınlanmış içerikten üretilir.
10. **AC-11.10** `robots.index=false` route sitemap'te bulunmaz ve metadata robots noindex üretir.
11. **AC-11.11** Audit sekmesi en az §7.3 finding türlerini gerçek route'a linkli üretir.
12. **AC-11.12** Route listesi revision payload gövdelerini çekmez ve bounded sayfalama/cursor kullanır.
13. **AC-11.13** Eski SEO field alias'ları temiz cutover sonunda kalmaz; metadata parity korunur.

## 13. Test ve Browser Doğrulaması

### Kalıcı testler

- Resolver precedence table.
- Rich text description extraction boundary.
- same-origin canonical validation.
- keywords normalization.
- JSON-LD type/safety/size.
- sitemap/noindex and hreflang published-only.
- alt resolution.
- metadata migration parity.

### Browser senaryosu

1. `/manage/seo` aç; route ara ve seç.
2. Source kartında otomatik title/description/image kaynaklarını gör.
3. İçerik editöründe title değiştir; draft save sonrası SEO preview yeni otomatik değeri göstersin, public metadata değişmesin.
4. Advanced title/canonical/OG asset gir; invalid external canonical'ın reddedildiğini gör.
5. Normal publish akışını tamamla; public `<title>`, meta description, canonical, OG ve JSON-LD'yi browser DOM'da doğrula.
6. noindex yapıp publish et; sitemap'ten çıktığını doğrula; test verisini geri al.

### Komutlar

- `npx tsc --noEmit`
- `npx eslint .`
- ilgili unit/integration/E2E testleri
- `npm run build`

## 14. Riskler

- **Otomatik SEO public'i erken değiştirir:** resolver draft preview ve published input'u kesin ayırır.
- **Canonical site dışına çıkar:** same-origin validation.
- **Structured data spam/XSS:** typed auto builders ve bounded custom JSON object; HTML/string script yok.
- **İki SEO kaynağı:** legacy field'lar migration sonrası kaldırılır; route component fallback'ları merkezi resolver'a taşınır.
- **Liste maliyeti:** route listesinde payload yok; seçili route için tek edit payload.
- **SEO “skoru” yanıltır:** deterministic findings gösterilir, uydurma 0–100 puan verilmez.

## 15. Definition of Done

- Bütün gerçek public route'lar merkezi SEO ekranından bulunabilir.
- Otomatik türetim ve explicit override aynı resolver ile preview/public metadata üretir.
- Canonical, hreflang, sitemap, robots, social, alt ve structured data kontratları doğrulanmıştır.
- Gerçek browser'da draft→publish metadata farkı kanıtlanmıştır.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- `architecture.md`, `project-overview.md` ve `progress-tracker.md` gerçek duruma güncellenmiştir.
