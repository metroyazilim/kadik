# Spec 8 — Yeniden Kullanılabilir Section Mimarisi ve Public Renderer Cutover

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-8 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 7 tamamlanmış olmalıdır  
**Paralellik:** Tek başına uygulanır; Prisma şeması, yayınlama ve public kompozisyon sınırlarını sahiplenir  
**Sonraki birimler:** Spec 9 sayfa düzenleyicisini, Spec 10 çeviri paketini, Spec 11 SEO merkezini bu veri kontratı üzerine kurar

## 1. Problem

Mevcut içerik mimarisi sayfa oluşturmayı desteklemiyor:

- `ContentPageKey` kapalı enum'u yalnız `about` değerini içeriyor.
- `/manage/pages` yalnız Hakkımızda editörünü açıyor.
- Home bölümleri `HomeSectionKey` kapalı setine ve ayrı `HomeLayout` modellerine bağlı.
- `ContentBlockKind` yalnız `RICH_TEXT`, `MEDIA`, `GALLERY`, `CTA` seviyesinde; public tasarımdaki Hero, collage, deneyim rozeti, istatistik, koleksiyon listesi, logo bulutu gibi tam section'ları ifade etmiyor.
- Bir Home/About section'ı başka sayfada referansla kullanılamıyor.
- Section bağımlılığı JSON içinde görünmezse güvenli kalıcı silme ve kullanım sayısı üretilemez.

## 2. Karar

`ContentEntity` / `ContentTranslation` / immutable revision / locale bazlı publish çekirdeği korunur. Üstüne iki açık kavram eklenir:

1. **ManagedPage:** public bir kompozisyon sayfasının dilden bağımsız kimliği ve route sahibi.
2. **ReusableSection:** türü registry tarafından doğrulanan, dört dilli bağımsız içerik varlığı.

Bir sayfanın sırası ve section yerleşimleri globaldir; locale'e göre çatallanmaz. Section içeriği locale bazında taslaklanır/yayınlanır. Sayfa layout'u immutable revision olarak saklanır ve her placement ilişkisel satırdır; section bağımlılıkları sorgulanabilir kalır.

Public renderer yalnız yayınlanmış page layout pointer'ı ile her section'ın yayınlanmış locale revizyonunu okur. Taslak hiçbir public okuyucuya sızmaz.

## 3. Görünür Sonuç

Bu altyapı birimi sonunda public tasarım değişmeden:

- Anasayfa ve Hakkımızda mevcut içeriklerini yeni ManagedPage + ReusableSection yapısından render eder.
- Aynı section kimliği birden fazla sayfanın yayınlanmış layout'unda kullanılabilir.
- Bir section bir kez güncellenip ilgili locale yayınlandığında onu kullanan tüm yayınlanmış sayfalarda güncellenir.
- “Bağımsız kopya” gereken durumda yeni section kimliği yaratılır; gizli copy-on-write davranışı yoktur.
- Eski Home/About özel registry okuyucuları public runtime'dan tamamen çıkar.

Bu spec tam sayfa builder UI üretmez; mevcut Home/About yönetim yüzeyleri yeni servislerin adaptörleriyle aynı davranışı sürdürür. Evrensel UI Spec 9'dur.

## 4. Kapsam

### 4.1 Kapsam içi

- Prisma modelleri, migration ve deterministic backfill.
- Page/section domain registry, Zod payload doğrulama ve immutable layout yayınlama servisi.
- Public page composer/renderer.
- Anasayfa ve Hakkımızda için kayıpsız cutover.
- Section usage/dependency sorguları.
- Cache tag/invalidation ve audit.
- Mevcut Home/About admin eylemlerinin yeni domaine bağlanması; görünür form alanları değişmez.

### 4.2 Kapsam dışı

- Genel sayfa liste/builder UI; Spec 9.
- Çeviri prompt/export/import; Spec 10.
- Gelişmiş SEO alanları; Spec 11.
- Hard delete; Spec 14, fakat gerekli dependency sorgusu bu spec'te sağlanır.
- Diğer tüm public sayfaların içerikle doldurulması; Spec 16.
- Public CSS/markup yeniden tasarımı.

## 5. Veri Modeli

İsimler uygulama sırasında Prisma ilişki çakışmalarına göre küçük biçimsel düzeltme alabilir; aşağıdaki semantik zorunludur.

### 5.1 `ManagedPage`

```prisma
model ManagedPage {
  id            String   @id @default(cuid())
  key           String   @unique
  name          String
  entityId      String   @unique
  system        Boolean  @default(false)
  archived      Boolean  @default(false)
  version       Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  entity        ContentEntity @relation(... onDelete: Restrict)
  layout        PageLayout?
}
```

- `key` teknik, dilden bağımsız ve immutable'dır (`home`, `about`, `services-index` gibi).
- `name` admin liste adı; lokalize public başlık değildir.
- `entity` sayfa düzeyi locale payload'ını taşır: internal name hariç başlık, açıklama, slug/route ve ileride SEO.
- `system=true` olan Home gibi sayfalar arşivlenemez/silinemez, fakat layout'u düzenlenebilir.
- `ContentPageKey` enum'una yeni değer ekleme modeli terk edilir.

### 5.2 `ReusableSection`

```prisma
model ReusableSection {
  id            String   @id @default(cuid())
  key           String   @unique
  name          String
  kind          String
  entityId      String   @unique
  archived      Boolean  @default(false)
  version       Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  entity        ContentEntity @relation(... onDelete: Restrict)
  placements    PageLayoutPlacement[]
}
```

- `kind` serbest davranış değildir; `sectionRegistry` içinde bulunmayan değer yazılamaz/render edilemez.
- `name` admin etiketi; `key` API/import kimliği.
- Localized section payload mevcut revision çekirdeğinde `contentType="page-section:<kind>"` ile tutulur.
- ReusableSection arşiv durumu ile alttaki ContentEntity arşiv durumu tek transaction'da tutarlı kalır; çift kaynak yerine mümkünse tek gerçek kaynak seçilir ve diğer alan kaldırılır. Uygulama kararı migration öncesi testle sabitlenir.

### 5.3 Page layout pointer'ları

```prisma
model PageLayout {
  id                  String   @id @default(cuid())
  pageId              String   @unique
  draftRevisionId     String?
  publishedRevisionId String?
  version             Int      @default(0)
  publishedAt         DateTime?
  ...
}

model PageLayoutRevision {
  id            String   @id @default(cuid())
  layoutId      String
  schemaVersion Int
  createdBy     String
  createdAt     DateTime @default(now())
  placements    PageLayoutPlacement[]
  ...pointer inverse relations...
}

model PageLayoutPlacement {
  id                String @id @default(cuid())
  revisionId        String
  placementKey      String
  sectionId         String
  order             Int
  enabled           Boolean @default(true)
  variant           String?
  settings          Json?
  ...relations...

  @@unique([revisionId, placementKey])
  @@unique([revisionId, order])
  @@index([sectionId])
}
```

Değişmezler:

- Layout revision ve placement satırları oluşturulduktan sonra update/delete edilmez.
- Yeni taslak kaydı önceki placement listesini kopyalar ve değişiklikleri yeni revision altında yazar.
- Publish yeni revision üretmez; `publishedRevisionId = draftRevisionId` pointer swap yapar.
- `placementKey` aynı section aynı sayfada iki kez kullanılsa bile yerleşimleri ayıran stabil kimliktir.
- `variant/settings` yalnız registry'de o kind için tanımlı non-localized sunum seçeneklerini içerir. Serbest CSS class, HTML veya dış URL taşımaz.
- Published ve draft dependency raporu ayrı hesaplanabilir.

### 5.4 İlişki ve silme

- `PageLayoutPlacement.sectionId` `onDelete: Restrict` kullanır.
- Bir section draft veya published layout'ta referanslıyken fiziksel silme doğrudan çalışmaz.
- Bir sayfanın layout/revision ağacı yalnız Spec 14'teki kontrollü hard delete servisi ile silinir.
- `ContentEntity`, çeviri ve revizyon pointer'larının mevcut Restrict/Cascade değişmezleri korunur.

## 6. Section Registry

Yeni `lib/content-model/section-registry.ts` tek otoritedir. Her definition şunları taşır:

- `kind`, admin label, kısa açıklama ve ikon adı.
- `schemaVersion`.
- Locale payload Zod schema'sı.
- `localizablePaths`: çeviri dışa aktarma için kesin alan listesi.
- `mediaPaths`: `MediaUsage` senkronizasyonu için kesin alan listesi.
- `defaultPayload(locale)`.
- `validatePlacementSettings`.
- Public renderer anahtarı.
- SEO extraction hook'u: başlık/açıklama adayları; Spec 11 kullanır.

İlk kapalı katalog:

| Kind | Amaç | Temel localized alanlar |
| --- | --- | --- |
| `hero` | Ana/landing hero | eyebrow, title parçaları, description, CTA etiketleri |
| `page-banner` | İç sayfa banner/breadcrumb | title, description, eyebrow |
| `rich-text` | Uzun içerik | title, body |
| `split-content` | Metin + medya | eyebrow, title, body, CTA |
| `media-collage` | Çoklu görsel kompozisyonu | alt/caption; medya kimlikleri registry media path |
| `experience-badge` | sayı/birim/açıklama | valueLabel, unit, caption |
| `feature-list` | “Sunduklarımız” benzeri liste | title, subtitle, item title/description/icon label |
| `stat-grid` | KPI/istatistik kartları | item value, unit, label |
| `logo-cloud` | müşteri/ödül/logolar | heading, item alt/caption |
| `cta` | çağrı bandı | title, description, button labels |
| `collection-feed` | hizmet/proje/blog/ekip liste section'ı | heading, description; `settings.contentType`, limit ve variant non-localized |
| `faq-list` | SSS koleksiyonu veya seçkisi | heading, intro; seçim ayarı non-localized |
| `testimonials` | yorumlar | heading ve item metinleri |
| `process-steps` | süreç adımları | heading, step title/body |
| `contact` | iletişim bilgisi/form birleşimi | heading, intro, labels |

Yeni bir section kind eklemek registry, payload migration, public renderer ve test gerektirir. Kullanıcı serbest React component adı yazamaz.

## 7. Reuse Semantiği

- **Yeniden kullan:** Yeni placement aynı `ReusableSection.id` değerini referanslar. İçerik ortak kalır.
- **Çoğalt:** Yeni `ReusableSection` + dört locale draft kopyası yaratır; sonraki değişiklikler bağımsızdır.
- **Yerleşim ayarı:** varyant/kolon/limit gibi sayfaya özgü ayarlar placement'tadır; metin/görsel section revision'ındadır.
- **Yayın etkisi:** ortak section locale'i yayınlandığında section'ı kullanan tüm yayınlanmış sayfa cache tag'leri outbox'a yazılır. Kullanıcı admin UI'da yayınlamadan önce kullanım sayısını görür.
- **Layout yayınlama:** section taslağını otomatik yayınlamaz. Published layout yayınlanmamış locale section ile karşılaşırsa validation hatası üretir; silent fallback yoktur.
- **Locale düzeni:** placement sırası tüm dillerde aynıdır. Bir dilde section metni yoksa sayfa publish validation'ı eksik section'ı listeler; public runtime draft/fallback kullanmaz.

## 8. Domain Servisleri

Yeni/yenilenen servisler:

- `ensureManagedPage(client, key, name, options)` — seed/migration only; runtime render sırasında create etmez.
- `createReusableSection(context, input)`.
- `saveSectionDraft(context, sectionId, locale, payload, expectedVersion)` — mevcut `saveDraft` çekirdeğini kullanır.
- `publishSection(context, sectionId, locale, expectedVersion)` — usage tabanlı invalidation üretir.
- `savePageLayoutDraft(context, pageId, placements, expectedVersion)` — transaction + immutable revision.
- `publishPageLayout(context, pageId, expectedVersion)` — pointer, audit, invalidation atomik.
- `getPageBuilderView(context, pageId, locale)` — Spec 9 için payload gövdeleri yalnız edit route'unda.
- `getPublishedManagedPage(client, key, locale)` — page metadata + published layout + published section revisions.
- `getSectionUsageReport(client, sectionId)` — draft/published sayfa ayrımı, page adı/path.
- `cloneReusableSection(context, sectionId, newName)`.

Tüm yazmalar `AdminContext` ve optimistic `expectedVersion` ister. Audit action adları sabit registry'den gelir; string dağınıklığı oluşturulmaz.

## 9. Public Renderer

`lib/public-pages/managed-page.ts` veya mevcut public composition sınırında:

1. ManagedPage `key` ile bulunur.
2. İstenen locale'in page-level published revision'ı çözülür.
3. Published layout revision + enabled placements `order ASC` alınır.
4. Her placement'ın ReusableSection entity'sinde aynı locale published pointer'ı çözülür.
5. Registry schemaVersion/payload doğrular ve ilgili mevcut public component'e typed view model üretir.
6. Bilinmeyen kind, bozuk schemaVersion veya eksik published section production'da admin detayı sızdırmayan kontrollü hata/skip politikası uygular; bu politika testte ve audit/diagnostic'te görünür olmalıdır. Varsayılan karar: tek bozuk section tüm siteyi 500 yapmak yerine section'ı render etme ve sunucu loguna structured diagnostic yaz; preview/publish validation bozuk duruma ulaşmayı engeller.

Renderer switch'i yalnız registry adapter katmanında bulunur. Route component'leri section kind switch'i yazmaz.

## 10. Home ve About Backfill/Cutover

### 10.1 Home

- Her mevcut `HomeSectionKey` kaydı uygun yeni section kind'ına deterministic eşlenir.
- `HomeLayout` draft/published sırası yeni PageLayout revision'larına aktarılır.
- `home` ManagedPage `system=true` ve root route semantiğiyle yaratılır.
- Mevcut Home payload'daki görsel kimlikleri ve localized alanlar kayıpsız taşınır.

### 10.2 About

Mevcut About payload şu section'lara ayrılır:

- banner → `page-banner`
- başlık/intro + collage → `split-content` ve `media-collage`
- experience value/unit/caption → `experience-badge`
- stats → `stat-grid`
- “Sunduklarımız” items/icons/subtitles → `feature-list`
- clients → `logo-cloud`
- awards → `logo-cloud` veya registry'de açık award variant'ı
- bodyTitle/body → `rich-text`
- mevcut SEO title/description page-level payload'ta korunur; Spec 11 genişletir

Backfill aynı kaynak kimliği + hash için tekrar çalıştığında ikinci page/section/revision üretmez. Önce dry-run manifest, sonra transaction'lı apply, sonra parity raporu.

### 10.3 Clean cutover

Parity kanıtlandıktan sonra:

- Public Home/About okuyucuları yalnız yeni domaine geçer.
- Eski `HomeSection`, `HomeLayout`, `HomeLayoutRevision`, `ContentPageRegistry`, `ContentPageKey` runtime çağrıları kaldırılır.
- Eski modeller aynı migration içinde ancak veri kopyası ve parity guard başarılıysa düşürülür. Üretim migration'ı destructive adımı otomatik çalıştırmıyorsa expand → backfill → cutover → contract ayrı migration'lar halinde uygulanır.
- Uyum alias'ı, çift yazma veya sonsuz fallback bırakılmaz.

## 11. Cache, Route ve Audit

- Tag'ler: `managed-page:<pageId>:<locale>`, `page-layout:<pageId>`, `reusable-section:<sectionId>:<locale>` ve section usage'tan türeyen public route tag'leri.
- Bir section publish'i, yalnız onu published layout'ta kullanan sayfaları invalidate eder.
- Page layout publish'i yalnız ilgili page route'larını invalidate eder.
- Audit olayları: `page.create`, `page.layout.save`, `page.layout.publish`, `section.create`, `section.clone`, `section.draft.save`, `section.publish`, `section.archive`.
- Pointer swap + audit + outbox aynı transaction'da kalır.

## 12. Dosya Sahipliği

- `prisma/schema.prisma`
- Bu spec için yeni additive/destructive migration klasörleri
- `lib/content-model/section-registry.ts`
- `lib/content-model/managed-page-*.ts`
- `lib/content-model/page-layout-*.ts`
- `lib/public-pages/managed-page.ts`
- Home/About public composition ve route adaptörleri
- Home/About admin actions yalnız yeni servise adaptasyon için
- `prisma/seed.ts` ve migration scriptleri yalnız deterministic registry/backfill için

Spec 8 uygulanırken Spec 9–16 aynı checkout'a yazmaz.

## 13. Kabul Kriterleri

1. **AC-8.1** Prisma şeması ManagedPage, ReusableSection ve immutable PageLayout revision/placement ilişkilerini içerir; section reference FK ile sorgulanabilir.
2. **AC-8.2** Aynı ReusableSection iki farklı page layout draft'ına eklenebilir; kullanım raporu iki sayfayı doğru draft/published statüsüyle listeler.
3. **AC-8.3** Section TR taslağını kaydetmek public çıktıyı değiştirmez; yayınlamak onu kullanan tüm published sayfaları günceller.
4. **AC-8.4** Page layout draft sırasını değiştirmek public sırayı değiştirmez; layout publish pointer swap sonrası değişir.
5. **AC-8.5** Published layout, hedef locale'de published revision'ı olmayan section ile yayınlanamaz ve eksik section adı/locale listelenir.
6. **AC-8.6** Home ve About backfill'i iki kez dry-run/apply edildiğinde duplicate kayıt üretmez.
7. **AC-8.7** Cutover öncesi ve sonrası Home/About için section sırası, metinler, medya kimlikleri ve public route çıktısı semantik parity raporunda eşittir.
8. **AC-8.8** Public Home/About hiçbir draft pointer'ı veya eski Home/About registry modelini okumaz.
9. **AC-8.9** `cloneReusableSection` yeni kimlik ve bağımsız draftlar üretir; kaynak section sonraki değişiklikten etkilenmez.
10. **AC-8.10** Section publish audit + pointer + invalidation outbox işlemleri aynı transaction'da başarılı veya geri alınır.
11. **AC-8.11** Arşivli section yeni placement'a eklenemez; mevcut published kullanım sessizce kaybolmaz.
12. **AC-8.12** Public görsel markup/CSS kasıtlı değişmez; masaüstü ve mobil screenshot karşılaştırmasında yalnız içerik kaynağı değişmiştir.
13. **AC-8.13** Eski Home/About özel runtime adapter'ları, çift yazma ve fallback alias'ları temiz cutover sonunda depoda kalmaz.

## 14. Doğrulama

### Kalıcı test değerine sahip kontratlar

- Page layout revision immutability ve optimistic version çatışması.
- Published/draft pointer ayrımı.
- Section reuse invalidation fan-out.
- Dependency report.
- Backfill idempotency/parity.
- Missing locale publish guard.

### Gerçek senaryo

1. Home'daki bir section'ı About draft layout'una reuse et.
2. About layout'u yayınla; iki public sayfada section görünür.
3. Section TR taslağını değiştir; iki public sayfa değişmez.
4. Section TR'yi yayınla; iki public sayfa güncellenir.
5. Section'ı clone et, About placement'ını clone'a geçir ve yayınla.
6. Clone içeriğini değiştir; Home etkilenmez.
7. Test verisini geri al.

### Komutlar

- `npx prisma validate`
- `npx prisma migrate dev` yerel/test DB üzerinde
- `npx tsc --noEmit`
- `npx eslint .`
- ilgili integration/E2E testleri
- `npm run build`

## 15. Riskler

- **Yıkıcı migration:** Eski modeller erken düşürülürse veri kaybı olur. Expand/backfill/parity/cutover/contract sırası zorunludur.
- **Reuse sürprizi:** Ortak section değişikliği birden fazla sayfayı etkiler. Publish öncesi kullanım listesi domain servisinden sağlanır; UI Spec 9'da gösterir.
- **N+1 sorgu:** Placement başına ayrı revision sorgusu yasaktır. Public okuyucu bounded include/select veya iki toplu sorgu kullanır.
- **Cache fan-out:** Tüm siteyi invalidate etmek yasaktır; published usage tablosundan hedef tag/path üretir.
- **Schema drift:** Section kind payload'ı schemaVersion olmadan parse edilmez; migration registry gereklidir.
- **JSON bağımlılığı:** Section referansları `settings` JSON'una gömülmez; FK placement satırında kalır.

## 16. Definition of Done

- Yeni veri modeli migration ile uygulanmış, deterministic backfill ve parity kanıtlanmıştır.
- Home/About gerçek browser'da yeni renderer üzerinden önceki görünüm ve yayın semantiğiyle çalışır.
- Reuse ve clone farkı uçtan uca kanıtlanmıştır.
- Eski Home/About runtime modelleri temiz cutover ile kaldırılmıştır.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- `architecture.md`, `project-overview.md` ve `progress-tracker.md` uygulanmış gerçeğe göre güncellenmiştir.
