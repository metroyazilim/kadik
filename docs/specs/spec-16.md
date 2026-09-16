# Spec 16 — metroyazilim.com İçerik Envanteri, İdempotent İçe Aktarım ve Public Parity

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-16 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Kaynak:** `https://www.metroyazilim.com/` ve aynı origin sitemap/public route'ları  
**Bağımlılık:** Spec 7–15 tamamlanmış olmalıdır  
**Paralellik:** Tek başına ve son içerik birimi; page/section/collection/media/SEO seed ve import sınırlarını sahiplenir

## 1. Hedef

Kaynak Metro Yazılım sitesindeki gerçek Türkçe içerik, medya ve route envanteri tek seferlik, denetlenebilir ve tekrar çalıştırılabilir bir migration ile Extech CMS'e alınır. Bütün hedef sayfalar lorem ipsum/boş alan yerine kaynak içerikle dolar. Public runtime kaynak siteye fetch/scrape yapmaz; import tamamlandıktan sonra Extech yalnız kendi PostgreSQL + MediaAsset/R2 verisini kullanır.

## 2. Doğrulanmış Kaynak Envanteri

2026-09-08 tarihinde `https://www.metroyazilim.com/sitemap.xml` şu route ailelerini içeriyordu:

- root: `/`
- indeks: `/hizmetler`, `/isler`, `/blog`, `/iletisim`, `/sss`
- 6 hizmet detayı
- 2 proje/iş detayı
- 4 blog detayı
- statik: `/calisma-surecimiz`, `/kurumsal-destek`, `/kariyer`, `/fiyatlandirma`
- 2 ekip detayı

Bu anlık liste sabit kabul edilmez. Import her çalışmada sitemap'i okuyup versioned manifest'e yazar; spec kabulü source snapshot tarihindeki tüm sitemap URL'lerini kapsar. Sitemap'te bulunmayan fakat header/footer veya içerik linklerinden erişilen aynı-origin public route'lar ayrıca crawl raporunda “discovered-not-in-sitemap” olarak listelenir ve insan onayı olmadan kapsam dışına atılmaz.

## 3. Ürün Kararları

- Source yalnız allowlist origin `https://www.metroyazilim.com`.
- Network erişimi yalnız CLI import/snapshot anında; admin/public request sırasında yok.
- İlk import yalnız gerçek kaynak dili `tr` için draft üretir. EN/RU/AR içerik uydurulmaz; Spec 10 akışıyla çevrilir.
- Import varsayılanı `--dry-run`; explicit `--apply` olmadan DB/R2 yazmaz.
- Imported content otomatik publish edilmez. Opsiyonel `--publish-tr` ancak dry-run parity raporu temiz ve explicit flag ile; güvenli varsayılan draft-only.
- Mevcut authored içerik kör overwrite edilmez. Provenance/source hash üzerinden conflict raporu çıkar.
- Public görsel tasarım kaynak siteden kopyalanmaz; yalnız metin, yapısal anlam, medya ve SEO içeriği mevcut Extech section/component'lerine map edilir.

## 4. CLI ve Artifact Kontratı

Yeni script:

```bash
npm run import:metroyazilim -- --snapshot ./tmp/metro-import
npm run import:metroyazilim -- --from-snapshot ./tmp/metro-import --dry-run
npm run import:metroyazilim -- --from-snapshot ./tmp/metro-import --apply
```

Gerekirse filtre:

- `--only path1,path2` geliştirme/doğrulama için.
- `--resume` yalnız manifest checkpoint; duplicate üretmez.
- `--publish-tr` ayrı ve explicit.

Snapshot dizini production source olarak repoya commit edilmezse import run artifact olarak saklanır. Geçici HTML/binary dosyalar cleanup'ta kaldırılır. Kalıcı tutulacak manifest küçük ve kişisel veri içermeyen `prisma/import-manifests/metroyazilim-<date>.json` olabilir; karar repo boyutu ve lisans/kişisel veri incelemesi sonrası.

Manifest:

```json
{
  "schemaVersion": 1,
  "sourceOrigin": "https://www.metroyazilim.com",
  "capturedAt": "...",
  "sitemapHash": "sha256:...",
  "routes": [
    {
      "sourceUrl": "...",
      "sourcePath": "/...",
      "status": 200,
      "contentType": "text/html",
      "bodyHash": "sha256:...",
      "discoveredLinks": [],
      "assets": [],
      "mappingStatus": "mapped"
    }
  ]
}
```

Her source response max byte/time/redirect sınırı ile alınır. Redirect yalnız same-origin; non-HTML ve asset tipleri magic-byte doğrulanır.

## 5. Güvenli Crawl

- URL parser origin equality; DNS/host override yok.
- `robots.txt` ve makul rate limit/concurrency (örn. 2–4) dikkate alınır.
- Retry bounded exponential; sonsuz retry yok.
- Sitemap XML boyutu/URL sayısı bounded.
- HTML parsing DOM parser ile; regex ile genel HTML parse edilmez.
- Script, form submit/login/admin/private endpoint takip etmez.
- Query/hash normalize edilir; tracking query'leri kaldırılır.
- `mailto:`, `tel:`, external social link içerik route'u yapılmaz.
- Binary asset max size, MIME magic bytes ve checksum.
- Source script/style/inline event handler asla CMS rich text'e alınmaz.

## 6. Kaynak → Hedef Route Matrisi

Dry-run her satır için explicit mapping üretir. Başlangıç matrisi:

| Kaynak | Hedef | CMS sahibi |
| --- | --- | --- |
| `/` | `/` | ManagedPage `home` + reusable sections |
| `/hizmetler` | `/servisler` | ManagedPage `services-index` + collection-feed |
| `/hizmetler/<slug>` | `/servisler/<mapped-slug>` | service ContentEntity |
| `/isler` | `/projeler` veya projede kanonik mevcut segment | projects-index ManagedPage |
| `/isler/<slug>` | mevcut kanonik proje detail segmenti | project ContentEntity |
| `/blog` | `/blog` | blog-index ManagedPage |
| `/blog/<slug>` | `/blog/<slug>` | post ContentEntity |
| `/iletisim` | `/iletisim` | contact ManagedPage |
| `/sss` | `/sss` | faq-index ManagedPage + FAQ entities/feed |
| `/calisma-surecimiz` | aynı kanonik Türkçe segment | ManagedPage + process-steps |
| `/kurumsal-destek` | aynı | ManagedPage |
| `/kariyer` | aynı | ManagedPage |
| `/fiyatlandirma` | aynı | ManagedPage |
| `/ekip/<slug>` | mevcut ekip detail segmenti | team ContentEntity |

Hedef segment gerçek route registry'den okunur; tabloda yazan tahmine göre string birleştirilmez. Kaynak slug yanlış yazım içeriyorsa public SEO değeri korunacak mı düzeltilecek mi dry-run raporunda açıkça gösterilir; mevcut inbound source URL için redirect planı üretilmeden silent slug düzeltmesi yapılmaz.

## 7. İçerik Çıkarma

Her route type için ayrı typed extractor bulunur. Genel “tüm DOM'u rich text yap” yaklaşımı yoktur.

### 7.1 Ortak çıkarımlar

- `<title>`, meta description, canonical, OG/Twitter.
- H1–H4, paragraflar, listeler, CTA labels/targets.
- Breadcrumb.
- Image src/srcset, alt, width/height/caption.
- JSON-LD yalnız source evidence olarak parse edilir; kör custom JSON-LD import edilmez. Hedef structured data Spec 11 auto resolver'dan yeniden üretilir.
- Header/footer site settings/nav/contact/social verisi dedupe edilir.

### 7.2 Home/page sections

DOM landmarks, headings ve known source component structure typed section mapper'a çevrilir:

- hero,
- hizmet/portfolio/blog collection feeds,
- istatistik,
- about/split content/collage,
- CTA,
- müşteri/logo cloud,
- testimonial,
- process steps,
- contact/FAQ.

Mapper bir section'ı tanıyamazsa raw HTML'i publish etmez; manifest `unmapped-fragment` ile source selector + text excerpt raporlar. Apply parity guard unmapped meaningful fragment varken varsayılan olarak başarısız olur.

### 7.3 Collections

- Service: title, slug, summary, rich body, hero/featured media, category/technology/CTA ve gerçek mevcut schema alanları.
- Project: title, slug, summary/body, client/industry/year/technologies/media gallery gibi source'ta gerçekten olan alanlar.
- Post: title, slug, excerpt/body, dates, category/tags, featured image, source author string.
- Team: name/title/bio/social/media.
- FAQ: question/answer/category/order.

Schema'da karşılığı olmayan source alanı drop edilmez; mapping gap raporu verir. Alan gerçekten ürün için gerekliyse önce ayrı registry schemaVersion/migration kararı alınır; import içinde `extra: any` torbası oluşturulmaz.

## 8. Hakkımızda ve Sitemap Dışı Hedefler

Kaynak sitemap'te ayrı `/hakkimizda` bulunmaması mümkündür. Hedef About boş bırakılmaz:

- Home'daki kurumsal/about anlatımı, deneyim/istatistik, sunduklarımız, müşteri/ödül alanları kaynak section'larından çıkarılıp About ManagedPage section'larına map edilir.
- Aynı içerik gerçek anlamda reuse edilecekse aynı ReusableSection referansı kullanılır; bağımsız edit gerektiriyorsa clone kararı manifest'te yazılır.
- Source'ta bulunmayan yasal/kurumsal metin uydurulmaz. Mevcut Extech authored içerik varsa korunur; yoksa `missing-source-content` raporu ve admin taslağında boş/eksik status kalır.

“Tüm sayfalar doldu” kabulü, kaynakta içerik olan bütün hedeflerin dolmasıdır. Kaynakta hiç bulunmayan hukuki metni modelin uydurması kabul edilmez.

## 9. Medya Aktarımı

1. Source asset URL same-origin veya açık allowlisted CDN mi doğrula.
2. Download bounded; magic-byte/MIME doğrula.
3. SHA-256 checksum ile mevcut MediaAsset dedupe.
4. Mevcut storage upload service kullan; doğrudan rastgele R2 SDK çağrısı yazma.
5. MediaUploadAttempt/durable cleanup kurallarını koru.
6. MediaAsset metadata: temiz filename, byteSize, dimensions, checksum, source provenance.
7. Kullanım başına locale alt/caption `MediaUsage` ile.
8. Dış URL payload'a yazılmaz.
9. SVG aktif içerik/script riskine karşı mevcut media policy; kabul edilmiyorsa raster/local güvenli alternatifi veya gap report.

Dry-run binary upload yapmaz; asset HEAD/GET gereksinimi snapshot aşamasında tamamlanmış olabilir.

## 10. Provenance ve İdempotency

Her imported root kayıt:

- `provenance = "import:metroyazilim"` veya mevcut alan formatına uygun registry değeri.
- sourcePath, source body hash, extractor version ve mapping key durable import mapping'de tutulur.
- Mevcut `LegacyMigrationMap` bu iş için semantik olarak yanlışsa yeniden kullanılmaz; açık `ExternalImportMap` modeli eklenir.

Önerilen model:

```prisma
model ExternalImportMap {
  id              String   @id @default(cuid())
  sourceSystem    String
  sourceKey       String
  sourceHash      String
  extractorVersion Int
  targetKind      String
  targetId        String
  lastImportedAt  DateTime
  @@unique([sourceSystem, sourceKey, targetKind])
}
```

Kurallar:

- Aynı hash/version: no-op.
- Source değişmiş, hedef son importtan beri değişmemiş: yeni draft revision update.
- Source değişmiş, hedef admin tarafından değiştirilmiş: conflict; overwrite yok.
- Source route silinmiş: hedef otomatik archive/delete edilmez; report.
- Apply yarıda hata: root mapping transaction rollback; storage orphan cleanup ledger çalışır.

## 11. Draft, Publish ve Çeviri

- Import TR draft'ları tek tek değil bounded transaction gruplarıyla yazar; her entity revision immutable.
- Page layout/section drafts Spec 8 servislerinden.
- Route collision preflight.
- `--publish-tr`: entity/section/page/layout dependency order'ında mevcut publish servislerini çağırır; audit/outbox invariant'ını atlamaz.
- EN/RU/AR source'ta yoksa missing status. Spec 10 export/import ile üretilir.
- Source meta title/description explicit değerleri yeni SEO override'a aktarılabilir; body'den türeyen tekrarlar boş bırakılıp Spec 11 auto resolver'a bırakılır.

## 12. Parity Raporu

Dry-run ve apply sonrası rapor:

- sitemap total/fetched/failed/mapped/unmapped.
- route family counts.
- source → target identity/path.
- her route için heading, paragraph/list item, CTA, image sayıları.
- dropped/sanitized/unmapped fragment.
- collection field completeness.
- media downloaded/deduped/failed/missing alt.
- SEO source/resolved comparison.
- existing-authored conflict.
- source-only ve target-only route.

Apply success kriteri: failed fetch 0, unmapped meaningful fragment 0 veya her biri açık approved exception manifest'i, required field error 0, route collision 0, orphan media 0.

## 13. Public Doğrulama

- Route matrixteki her imported target 200 ve kaynak ana başlık/metin/medya semantiğini gösterir.
- Index sayıları detail entity sayılarıyla tutarlı.
- Internal linkler hedef canonical route'a gider; source origin'e yanlış runtime link kalmaz (harici kurumsal linkler hariç).
- Görseller MediaAsset resolver üzerinden, source hotlink yok.
- Metadata/canonical/hreflang/sitemap Spec 11 kurallarına uyar.
- Mobile/desktop layout mevcut Extech tasarımıdır; source pixel parity aranmaz.
- Public network kaydında `metroyazilim.com` content/API/image runtime isteği yoktur.

## 14. Dosya Sahipliği

- `scripts/import-metroyazilim.ts` ve typed extractor/mapping modules
- Gerekli `ExternalImportMap` Prisma migration/modeli
- `prisma/seed.ts` yalnız import verisini seed ile karıştırmamak için açık entegrasyon
- Content/page/section/media/SEO servis adaptörleri; iş kurallarını bypass etmez
- Route redirect registry yalnız mapping raporu onaylıysa
- Import test fixtures (küçük sanitize edilmiş HTML), tam site dump'ı değil

Public components ve CSS bu spec'te yeniden tasarlanmaz.

## 15. Kabul Kriterleri

1. **AC-16.1** Snapshot manifest'i source sitemap'teki tüm URL'leri ve discovered same-origin public route'ları status/hash ile içerir.
2. **AC-16.2** Dry-run DB/R2'yi değiştirmez ve route/field/media/conflict/parity raporu üretir.
3. **AC-16.3** Apply aynı snapshot ile iki kez çalıştığında duplicate page/section/entity/revision/media/mapping üretmez.
4. **AC-16.4** Source değişmiş ve target authored değişmişse overwrite yerine conflict raporu verir.
5. **AC-16.5** Kaynaktaki bütün anlamlı section/collection alanları typed target schema'ya map edilir; tanınmayan içerik sessiz drop/raw HTML olmaz.
6. **AC-16.6** Tüm source medya checksum dedupe ve mevcut upload/usage kurallarıyla MediaAsset olur; public hotlink kalmaz.
7. **AC-16.7** TR içerik gerçek source metnidir; EN/RU/AR uydurulmaz ve eksik/taslak durumu açık kalır.
8. **AC-16.8** Import default draft-only; explicit publish mevcut publish/audit/outbox servislerini kullanır.
9. **AC-16.9** Route matrixteki her target browser'da 200, doğru ana içerik ve internal links ile çalışır; source-only/target-only farkları raporludur.
10. **AC-16.10** Source'ta ayrı About yoksa mevcut kurumsal Home section'ları açık reuse/clone kararıyla About'u doldurur; mevcut authored içerik kaybolmaz.
11. **AC-16.11** Runtime browser network'ünde metroyazilim.com content/image/API isteği yoktur.
12. **AC-16.12** Fetch/parse/sanitize/media hatasında partial published state veya orphan storage bırakılmaz.
13. **AC-16.13** Geçici snapshot/dump/test kayıtları cleanup'ta kaldırılır; yalnız kararlaştırılmış küçük manifest/fixtures kalır.

## 16. Test ve Gerçek Doğrulama

### Kalıcı testler

- URL allowlist/redirect/size guards.
- Typed extractor fixtures.
- HTML/Tiptap sanitize.
- Idempotent mapping and authored conflict.
- Media checksum dedupe/orphan cleanup.
- Route collision and internal link rewrite.
- Dry-run no writes.

### Browser matrisi

- Root, bütün index/statik sayfalar.
- Her collection family'den en az bir detail; ek olarak otomatik route crawler tüm imported target'larda status/heading/internal broken link kontrolü.
- Home/About reuse örneği.
- SEO metadata sample.
- 1440px ve 390px sample screenshots.
- Network request origin assertion.

### Komutlar

- Import snapshot/dry-run/apply komutları ve parity artifact'i
- `npx prisma validate` / migration
- `npx tsc --noEmit`
- `npx eslint .`
- ilgili integration/E2E/crawler testleri
- `npm run build`

## 17. Riskler

- **Kaynak markup değişir:** extractor version + unmapped fragment fail-closed.
- **Telif/kişisel veri:** yalnız kullanıcının belirttiği kurumsal public source; manifestte raw gereksiz veri tutulmaz, blog/team kişisel alanları görünür source ile sınırlı.
- **Source hotlink:** tüm medya local/R2 MediaAsset.
- **Authored içerik kaybı:** provenance/hash conflict.
- **Yanlış slug/canonical:** ContentRoute registry + explicit mapping/redirect report.
- **Import runtime bağımlılığı:** CLI dışında source fetch yasak.
- **Büyük tek transaction:** bounded batches + idempotent maps; publish pointer invariant her entity işleminde korunur.

## 18. Definition of Done

- Kaynak sitemap ve discovered public route'ların tamamı manifest/parity raporunda hesaplıdır.
- Kaynakta içerik bulunan tüm hedef page/collection alanları gerçek içerikle doludur.
- Import tekrar çalıştırılabilir, conflict-safe, draft-first ve medya bakımından self-contained'dır.
- Public site gerçek browser/crawler doğrulamasında kaynak içeriği kendi DB/R2'sinden sunar.
- Runtime source isteği, placeholder/lorem, unmapped meaningful fragment ve orphan medya yoktur.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- `project-overview.md`, `architecture.md` ve `progress-tracker.md` son gerçek durumu yansıtır.
