# Architecture Context

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Next.js 16.3.4 App Router (Turbopack), React 19.2.8, TypeScript 5.9 | Public ve admin uygulaması |
| UI | Tailwind CSS 4 + CSS custom property token seti | Public görsel dil ve admin panel tasarımı |
| Icons | lucide-react | Tüm ikonlar |
| Database | PostgreSQL + Prisma 6.19 | İçerik kimliği, revizyon, route, audit, mesaj, medya metadatası |
| Validation | Zod 4 | Sınır ve payload doğrulaması |
| Auth | jose (JWT) + HTTP-only cookie | `/manage` erişim sınırı |
| Rich text | Tiptap 3 | Uzun metin alanları |
| Reordering | dnd-kit | Pointer ve klavye ile sürükle-bırak |
| Media storage | Cloudflare R2 (S3 uyumlu API) | Görsel/dosya baytları |
| Testing | Playwright (unit-style, integration, e2e) | Kontrat, izole PostgreSQL ve tarayıcı testleri |

Next.js kodu değiştirilmeden önce `node_modules/next/dist/docs/` altındaki kurulu dokümantasyon okunur; bu sürüm genel model bilgisinden yenidir.

## System Boundaries

- `app/manage/` — oturum korumalı yönetim route'ları. Her bölüm kendi klasörü: liste `page.tsx`, düzenleme `[id]/page.tsx`, oluşturma `new/page.tsx`, sunucu eylemleri `actions.ts`
- `components/admin/` — yönetim kabuğu ve paylaşılan admin UI primitifleri (sidebar, topbar, kart, tablo, form alanları, toast)
- `app/`, `app/[locale]/`, dil route grupları — public route adaptörleri ve metadata giriş noktaları
- `lib/content-model/` — içerik kuralları, değişmez revizyonlar, doğrulama, yayınlama, kompozisyon
- `lib/public-content/`, `lib/public-pages/` — yalnızca yayınlanmışı okuyan modeller ve public görünüm modelleri
- `lib/media/` — R2 depolama, medya yaşam döngüsü, yükleme doğrulaması, kullanım kuralları
- `lib/i18n/` — dil kaydı, yön (dir), route segment tanımları
- `lib/migration/` — idempotent legacy backfill ve cutover adaptörleri
- `prisma/` — şema, eklemeli migration'lar, deterministik seed
- `docs/context/` — bu altı bağlam dosyası
- `docs/specs/` — özellik birimi başına bir uygulama spesifikasyonu

## Storage Model

- **PostgreSQL**: `ContentEntity` (kimlik, sıra, arşiv), `ContentTranslation` (dil başına taslak/yayın işaretçisi), `ContentTranslationRevision` (değişmez payload), `ContentRoute` (yayınlanmış adresler), `MediaAsset`/`MediaUsage` (metadata ve kullanım), `AuditLog`, `Message`, `InvalidationOutboxEvent`
- **Cloudflare R2**: yalnızca medya baytları. Veritabanı bayt saklamaz, R2 metadata saklamaz.
- **Cache**: Next.js route cache ve etiket bazlı invalidation. Yayınlama işlemi etkilenen etiketleri geçersiz kılar.

## Content Model

- Kanonik diller yalnızca `tr` (öneksiz) ve `en` (Global, `/en` önekli); `ContentLocale` enum'u bu iki değerdir.
- Bir mantıksal içerik kaydının tek, dilden bağımsız varlık kimliği vardır.
- Her dilin kendi çeviri kimliği ve taslak/yayın işaretçisi vardır.
- Revizyonlar değişmezdir: kaydetme yeni taslak revizyonu yaratır, yayınlama yalnızca işaretçiyi ileri alır.
- Kimlik, sıra, arşiv durumu, medya kullanımı, audit ve route kayıtları dil başına çatallanmaz.
- Public okuyucular yalnızca yayın işaretçisini çözer.

## Page Composition

- Sayfa yapısı koddadır: her public sayfanın component ağacı ve sırası `components/` ile `lib/public-pages/` içinde sabittir. Admin bölüm ekleyemez, silemez, sıralayamaz veya tasarım tipi seçemez.
- Anasayfa sabit 11 bölümdür (`HOME_SECTION_KEYS`): hero, about, brandTrust, services, process, achievements, projects, marquee, team, testimonials, blog. Sıra bu dizidedir; değiştirmek kod değişikliğidir.
- Her bölümün locale-aware alanları kendi `home-section:<key>` `ContentEntity` çevirisinin revision payload'ında `widget` olarak durur. Kaydet-ve-yayınla tek işlemde draft revision üretir ve published pointer'ı ileri alır.
- `lib/content-model/home-fixed-defaults.ts` boş bırakılan alanı dictionary değerine düşürür; admin bir alanı silince site varsayılan metne döner, boş görünmez.
- Koleksiyon bölümleri (services, projects, team, blog) kendi kayıt tablosundan beslenir. Admin yalnız grid kolon sayısı, kayıt adedi ve seçim kuralını (`latest` / `manual` / `category`) belirler; kart içerikleri kayıt editörlerinde kalır.
- Görseller/ikonlar payload'da `MediaAsset.id` olarak saklanır (`bgImageAssetId`, `processItems[].iconAssetId`, `kpiItems[].iconAssetId`, `testimonialItems[].avatarAssetId`, `logoItems[].assetId`); URL admin ve public okuma sınırlarında toplu çözülür.
- Diğer sayfaların sabit metinleri dictionary tabanlıdır: `lib/page-copy-registry.ts` düzenlenebilir alanları tanımlar, `/manage/pages/copy/<pageKey>` bunları dil bazında yazar, `SiteContent<Locale>.dictionary` kaydına merge edilir.
- `PageLayout`/`PageSection`/`ReusableSection` tabloları ve `HomeLayout` revision modülleri artık hiçbir runtime yolunda okunmaz; legacy şema olarak kalır.

## Approved Future Architecture — Remaining Spec 8–16 Work

- Public renderer cutover'ı tamamlandı; kalan iş kayıt editörleri ve aşağıdaki maddelerdir.
- TR çeviri export/import paketi registry `localizablePaths` alanlarından üretilir; EN/RU/AR apply tek transaction ve draft-only'dir.
- SEO override revision payload'ında versioned kalır; otomatik preview ve public metadata aynı resolver'ı, farklı draft/published girdiyi kullanır.
- RBAC tek permission registry'den route, nav, query ve action katmanlarına uygulanır. Developer Mode global ayar değil, SUPER_ADMIN'a bağlı kısa ömürlü capability'dir.
- `example-starter.com` yalnız offline CLI import kaynağıdır; public/admin runtime bu origin'e içerik veya medya isteği yapmaz.

Bu gelecek maddeleri uygulanmış storage iddiası değildir. Migration ve cutover tamamlandıkça normal mimari bölümlerine taşınır.

## Auth and Access Model

- `/manage/login` publictir; `/manage` altındaki diğer tüm adresler geçerli admin oturumu ister.
- Oturum kontrolü `app/manage/(panel)/layout.tsx` içinde bir kez yapılır; oturum yoksa `/manage/login`'e yönlendirilir.
- Sunucu mutasyonları `AdminContext`'i merkezî olarak çözer; yetki ve audit uygulama servis sınırında işler.
- UI'ya dönen hatalar token, secret, Prisma şekli, SQL veya stack trace sızdırmaz.

## Invariants

1. Public sayfalar hiçbir koşulda taslak işaretçisini (`draftRevisionId`) veya değişebilir admin satırını okumaz.
2. Her yönetim ekranı kendi route'udur. Rutin liste, oluşturma, düzenleme, sıralama ve medya seçme akışları drawer veya modal içinde yaşamaz; medya seçici gibi yalnızca gerçekten geçici olan seçim yüzeyleri istisnadır.
3. Bir liste sorgusu sayfalanır (`take`/`skip`) ve yalnızca listede gösterilen alanları seçer; taslak/yayın payload gövdeleri liste sorgusuna dahil edilmez.
4. Bir mutasyondan sonra tüm sayfa ağacını yeniden kuran istemci yenilemesi (`router.refresh()` zinciri) kullanılmaz; sunucu eylemi kendi route'unu `revalidatePath`/`revalidateTag` ile geçersiz kılar.
5. Yayın işaretçisi, audit kaydı ve invalidation olayı ya birlikte başarılı olur ya birlikte geri alınır.
6. Renk, boşluk, yarıçap ve tipografi yalnızca `docs/context/ui-context.md`'de tanımlı token'lardan gelir; ham hex değeri yazılmaz.
7. Zengin metin Tiptap ile yazılır, sunucuda yazma sınırında ve public render sınırında sanitize edilir; editör UI'ı güven sınırı değildir.
8. Sıralama dnd-kit pointer ve klavye sensörleriyle yapılır; sayısal sıra girişi yasaktır.
9. Görseller `MediaAsset` + R2 üzerinden çözülür; serbest dış görsel URL alanı eklenmez.
10. Route, başlık, navigasyon öğesi ve metadata alternatifleri registry'den üretilir; string birleştirmeyle uydurulmaz.
11. Türkçe ve Global dışındaki diller için route, sözlük, `ContentLocale` değeri veya hreflang alternatifi üretilmez; bu diller tarayıcı/Google çevirisine bırakılır.
12. Bir birim, gerçek yönetim→public akışı bildirilen local SHA üzerinde tarayıcıda çalışmadan tamamlanmış sayılmaz.
