# Spec 1 — Yönetim Paneli: Route Başına Gerçek Sayfa ve wpfuk Görsel Dili

**Durum:** Uygulanıyor
**Uygulama komutu:** `spec-1 uygula`
**Oluşturuldu:** 2026-09-08
**Kanonik depo:** `/Users/berat/extech` (branch `main`)
**Görsel referans:** `example-starter/organization-wpfuk` → `src/app/manage`, `src/components/manage`, `src/app/globals.css`

## 1. Hedef ve Görünür Sonuç

Yönetim paneli, tek `/manage?panel=X` adresinde yaşayan query-state bir uygulamadan, her ekranın kendi adresi olan gerçek bir çok sayfalı yönetim paneline dönüşür ve görsel olarak wpfuk yönetim panelinin birebir aynısı olur.

Bu birim tamamlandığında:

- `/manage/services`, `/manage/posts`, `/manage/media`, `/manage/seo` gibi adresler doğrudan açılır, yenilenebilir, paylaşılabilir ve tarayıcı geri tuşuyla gezilebilir.
- Yeni kayıt `/manage/<bölüm>/new`, düzenleme `/manage/<bölüm>/<entityId>` adresinde **tam sayfa** açılır. Hiçbir rutin akış drawer/modal içinde kalmaz.
- Panel görünümü wpfuk referansındaki kabuktur: 256px sabit sol kenar çubuğu (bölümlenmiş navigasyon, aktif öğede kırmızı işaret, altta kullanıcı kartı ve çıkış), sticky üst çubuk, `#f7f8fa` sayfa zemini, beyaz kartlar, `--radius-sm/md/lg` keskin köşeler, sağ altta toast.
- `/manage/login` iki panelli (form + lacivert marka bloğu) giriş ekranıdır.
- Bir bölüme girmek, o bölümün listelediği sayfa kadar veri çeker: liste sorgusu sayfalanır ve revizyon payload gövdelerini çekmez.
- Bir kaydetme veya yayınlama tek sunucu turunda tamamlanır; ardından tüm sayfa ağacını yeniden kuran `router.refresh()` zinciri çalışmaz.
- Her bölümün kendi `loading.tsx`'i vardır; adres değişip ekranın sessizce eski kalması ortadan kalkar.

## 2. Doğrulanmış Mevcut Davranış

2026-09-08 tarihinde `main` üzerinde, `npm run dev` (Next 16.3.4 + Turbopack) ve yerel PostgreSQL ile ölçüldü:

- 14 panelin tamamı `app/manage/(workspace)/page.tsx` içindeki tek `switch` ile render ediliyor; route `/manage`, panel `?panel=` ile seçiliyor. Sayfa `export const dynamic = "force-dynamic"`.
- `app/manage/<bölüm>/page.tsx` dosyaları var ama gerçek sayfa değil: her biri `redirect("/manage?panel=<bölüm>")` yapıyor.
- Düzenleme `components/admin/EditorDrawer.tsx` içinde açılıyor; drawer durumu `?item=` query parametresi.
- Ölçülen istek deseni (sunucu logu): drawer açmak = 1 tam sayfa RSC GET + 2 kez `get<X>EditViewAction` (aynı çağrı iki kez); taslak kaydetme = eylem + edit-view refetch + tam sayfa GET; yayınlama = aynı üç tur.
- `listCollectionEntities` (`lib/content-model/collection-admin.ts:44`) sayfalama yapmıyor ve her çeviri için hem `draftRevision.payload` hem `publishedRevision.payload` çekiyor. Ölçüm (yerel seed): hizmet 33.6 KB, ekip 35.9 KB, SSS 27.7 KB JSON — her navigasyonda.
- `(workspace)` grubunda `loading.tsx` yok (`layout.tsx` yorumu Next 16.3.x Suspense hatası nedeniyle bilinçli kaldırıldığını söylüyor). `PanelLink` `startTransition` + `router.push` kullanıyor: URL anında değişiyor, içerik sunucu turu tamamlanana kadar eski kalıyor, hiçbir bekleme göstergesi yok.
- 98 `revalidatePath` çağrısı var; `revalidatePath("/manage/<bölüm>")` çağrıları ölü — o adresler yalnızca redirect stub'ı.
- Görsel katman elle yazılmış Tailwind sınıfları: `components/admin/form-styles.ts` ve 46 satırlık `app/manage/admin.css`. Tasarım token seti yok.
- Testler `?panel=` adreslerine bağlı: 14 test dosyasında 61 referans.

## 3. Kapsam

### Kapsam İçi

- `/manage` altındaki tüm route yapısının query-state'ten route başına gerçek sayfaya taşınması.
- wpfuk token setinin ve yönetim kabuğunun uygulanması; tüm admin bileşenlerinin bu token setine geçirilmesi.
- Liste sorgularının sayfalanması ve alan seçimiyle daraltılması.
- Mutasyon sonrası tur sayısının düşürülmesi (`router.refresh()` zincirinin kaldırılması, `redirect()` + hedef route invalidation).
- Bölüm başına `loading.tsx`.
- `/manage/login` ekranının iki panelli tasarıma geçirilmesi.
- `?panel=`/`?item=` adreslerinden yeni route'lara kalıcı yönlendirme.
- Testlerin yeni adres kontratına göre güncellenmesi.

### Kapsam Dışı

- Public sitenin görsel dili, düzeni veya route'ları.
- İçerik modeli (`ContentEntity`/`ContentTranslation`/`ContentTranslationRevision`) ve yayınlama semantiği.
- Prisma şeması ve migration'lar (bu birim şema değiştirmez).
- Yeni yönetim özellikleri (rol/yetki ayrımı, yeni içerik tipi, yeni alan).
- Legacy dil başına tabloların emekliye ayrılması.
- Koyu tema.

## 4. Korunacak ve Yeniden Kullanılacak Mevcut Yapılar

Bu birim mevcut iş mantığını **yeniden yazmaz**; yalnızca sunum ve navigasyon katmanını değiştirir.

| Korunur | Not |
| --- | --- |
| `app/manage/<bölüm>/actions.ts` (14 dosya) | Sunucu eylemleri korunur; yalnızca `revalidatePath` hedefleri düzeltilir ve gereksiz refetch'ler kaldırılır |
| `lib/content-model/**` | Yayınlama, doğrulama, bağımlılık, sıralama mantığı aynen kalır |
| `lib/media/**`, `lib/i18n/**`, `lib/public-*/**` | Dokunulmaz |
| `components/admin/RichTextEditor.tsx` + `rich-text/` | Korunur, token setine uyarlanır |
| `components/admin/MediaField.tsx`, `MediaGalleryField.tsx`, `MediaPickerModal.tsx`, `useMediaUpload.ts` | Korunur; medya seçici modal olarak kalır (geçici seçim yüzeyi istisnası) |
| `components/admin/SortableList.tsx`, `HomeBlockComposer.tsx`, `ContentBlockEditor.tsx`, `LocaleTabs.tsx` | Korunur, token setine uyarlanır |
| `components/admin/ArchiveDeleteDialog.tsx` | Korunur (onay diyaloğu; rutin düzenleme akışı değil) |
| `app/manage/*/…EditorPanel.tsx` | İçerik/alan yapısı korunur; drawer içeriği olmaktan çıkıp sayfa gövdesine taşınır |
| `prisma/schema.prisma`, `prisma/seed.ts` | Değişmez |

**Silinir:** `app/manage/(workspace)/` (layout + page), `components/admin/EditorDrawer.tsx`, `components/admin/PanelDrawer.tsx`, `components/admin/PanelLink.tsx`, `components/admin/panel-types.ts`, `components/admin/form-styles.ts` (token tabanlı `components/admin/ui.ts` ile değiştirilir).

## 5. Yönetim Akışları

### 5.1 Oturum

1. Yönetici `/manage/login` adresine gider: solda form, sağda lacivert marka bloğu (mobilde blok gizli).
2. Hatalı giriş formun içinde kırmızı kutuda gösterilir; oturum çerezi yazılmaz.
3. Başarılı giriş `/manage` adresine yönlendirir.
4. Oturumsuz herhangi bir `/manage/*` adresi `/manage/login`'e yönlendirir. Kontrol `app/manage/(panel)/layout.tsx` içinde bir kez yapılır.

### 5.2 Genel Bakış

1. `/manage` yönetim özetidir: içerik tipi başına toplam/yayında/taslak sayıları (`ContentEntity` + `ContentTranslation` üzerinden `count`), okunmamış mesaj sayısı, son 5 audit kaydı.
2. Kartlar ilgili bölüme bağlantı verir.

### 5.3 Koleksiyon bölümleri (services, products, projects, team, faq, posts)

1. `/manage/<bölüm>` liste sayfası: `PageHeader` (başlık, açıklama, "Yeni …" birincil bağlantısı) → özet kartları → kart içinde tablo → sayfalama.
2. Tablo satırı: başlık + slug, dört dil için durum etiketi (yayında/taslak/eksik), sıralama tutamacı, "Düzenle" bağlantısı, "Arşivle/Sil" eylemi.
3. Sayfalama: sayfa başına 20 kayıt, `?page=` ile; sayfa 1 varsayılan.
4. Sıralama sürükle-bırak ile yapılır ve yalnızca görüntülenen sayfada geçerlidir; sıra kaydetme sunucu eylemi ile yapılır ve sayfa yeniden kurulmaz (iyimser sıra + eylem).
5. "Yeni …" `/manage/<bölüm>/new` adresine gider: sunucu tarafında boş varlık yaratılır ve `/manage/<bölüm>/<entityId>` adresine `redirect()` edilir.
6. `/manage/<bölüm>/<entityId>` tam sayfa düzenleme ekranıdır: geri bağlantılı `PageHeader`, dil sekmeleri (`?locale=`), alan formu, blok düzenleyici, medya alanları, formun sonunda "Taslağı kaydet" ve "Bu dili yayınla".
7. Kaydetme/yayınlama sonrası sonuç toast ile bildirilir; sayfa verisi yalnızca ilgili route'un invalidation'ı ile tazelenir. Ek `get…EditViewAction` turu yapılmaz — düzenleme verisi sayfanın kendi sunucu render'ında gelir.
8. Arşivleme/silme onay diyaloğundan geçer; başarıdan sonra liste sayfasına `redirect()` edilir.

### 5.4 Tekil bölümler

| Route | İçerik |
| --- | --- |
| `/manage/home` | Anasayfa bölüm listesi + düzen tahtası; bölüm düzenleme `/manage/home/[key]`, yayın önizleme `/manage/home/publish` |
| `/manage/site-content` | Dört dilli sözlük düzenleyici (mevcut `SiteContentEditor`) |
| `/manage/pages` | Hakkımızda ve diğer tekil sayfa düzenleyicileri (`AboutEditorPanel`) |
| `/manage/site-settings` | Site ayarları düzenleyici (`SiteSettingsEditor`) |
| `/manage/messages` | Gelen kutusu listesi + `/manage/messages/[id]` detay sayfası |
| `/manage/media` | Medya kütüphanesi (yükleme + ızgara + metadata) |
| `/manage/seo` | SEO denetim yüzeyi |
| `/manage/audit` | Denetim kaydı listesi, sayfalanmış |

Mesaj detayının ayrı sayfaya taşınması bu birimin parçasıdır: mevcut `MessagesWorkspace` iki panelli (liste + seçili mesaj) yapısı liste sayfası + detay sayfasına bölünür.

### 5.5 Eski adreslerin yönlendirilmesi

`/manage?panel=<key>` ve `/manage?panel=<key>&item=<id>` adresleri kalıcı olarak yeni route'lara yönlendirilir (`/manage/<key>`, `/manage/<key>/<id>`). Yönlendirme `/manage` sayfasının kendisinde, `searchParams.panel` varsa `redirect()` ile yapılır.

## 6. UI ve Bileşen Davranışı

Tüm renk/yarıçap/tipografi kararları `docs/context/ui-context.md` token setinden gelir. Ham hex yazılmaz.

### 6.1 Token seti

`app/manage/admin.css` yeniden yazılır: `:root` altında token tanımları (wpfuk `globals.css` ile aynı değerler), Tailwind 4 için `@theme inline` eşlemesi, `.admin-root` kapsamı, `:focus-visible` kuralı, form input kontrast düzeltmeleri ve `prefers-reduced-motion` bloğu. Public `app/globals.css` değiştirilmez.

### 6.2 Kabuk bileşenleri (`components/admin/`)

| Bileşen | Davranış |
| --- | --- |
| `AdminShell` | `"use client"`. `ToastProvider` + `AdminSidebar` + `AdminTopbar` + `<main className="px-4 py-6 lg:px-8 lg:py-7">`. Gövde `admin-root min-h-svh bg-[var(--admin-bg-page)]`, içerik sarmalayıcı `lg:ml-64` |
| `AdminSidebar` | `"use client"`. `usePathname()` ile aktif durum. Bölümlenmiş navigasyon: **Genel** (Genel Bakış, Medya, Mesajlar), **Sayfa Düzenleyiciler** (Anasayfa, Sayfalar, Site İçeriği, Site Ayarları), **Koleksiyonlar** (Hizmetler, Ürünler, Projeler, Ekip, SSS, Gönderiler), **SEO ve Sistem** (SEO, Audit). Aktif öğe: `bg-zinc-100 font-bold`, solda `-left-4 h-5 w-1 rounded-r-full bg-[var(--accent)]` işaret, ikon `text-[var(--accent)]`. Altta kullanıcı e-postası, baş harf avatarı ve "Çıkış yap" formu. `lg` altında çeviriyle açılan çekmece + arka plan perdesi |
| `AdminTopbar` | `"use client"`. Sticky, yarı saydam beyaz, alt kenarlıklı. Mobilde menü düğmesi, `sm` üstünde bölüm etiketi, sağda yeni sekmede açılan "Siteyi görüntüle" bağlantısı |
| `PageHeader` | Sunucu bileşeni. `eyebrow` (büyük harf, `--accent`), `title`, `description`, opsiyonel `backHref`, opsiyonel `actionHref`/`actionLabel` birincil düğme |
| `StatCard` | Sunucu bileşeni. Büyük harf etiket, büyük değer, ipucu satırı; ton seçenekleri: nötr, başarı, uyarı, vurgu |
| `SectionCard` | `"use client"`. Açılır/kapanır form bölümü; ikon kutusu, başlık, açıklama, chevron |
| `StatusPill` | Sunucu bileşeni. `ok`/`missing`/`draft` durumları için etiket |
| `LocaleStatusBadge` | Dört dil için durum hücresi (`yayında`/`taslak`/`eksik`) |
| `Toast` + `ToastProvider` + `ToastForm` | `"use client"`. Sağ altta, `role="status"`, 3.8 s sonra kaybolur; `ToastForm` sunucu eylemi sonucunu (`{ error }` / başarı) toast'a çevirir |
| `DeleteButton` | `"use client"`. Onay isteyen yıkıcı eylem düğmesi |
| `AuthLayout` | Sunucu bileşeni. Solda form alanı, sağda `--bg-invert` marka bloğu (nokta desenli), `lg` altında blok gizli |
| `Pagination` | Sunucu bileşeni. `?page=` bağlantıları, toplam sayı ve aralık metni |
| `ui.ts` | Token tabanlı sınıf sabitleri (`primaryButton`, `secondaryButton`, `card`, `tableWrap`, `input`, `label`, `fieldError`) — `form-styles.ts` yerine |

Mevcut alan bileşenleri (`RichTextEditor`, `MediaField`, `MediaGalleryField`, `MediaPickerModal`, `SortableList`, `LocaleTabs`, `ContentBlockEditor`, `HomeBlockComposer`, `ArchiveDeleteDialog`) korunur; sınıfları token setine geçirilir, davranışları değişmez.

### 6.3 Erişilebilirlik

- Kenar çubuğu `<nav>` içinde `<ul>`; aktif öğe `aria-current="page"`.
- Mobil çekmece açıkken kapatma düğmesi odaklanır, `Escape` kapatır, arka plan perdesi tıklanınca kapatır.
- Her form alanının `<label>`'ı vardır; hata metni `aria-describedby` ile alana bağlanır.
- Toast `role="status"`, `aria-live="polite"`.
- Tablo başlıkları `<th scope="col">`.
- Sürükle-bırak dnd-kit pointer **ve** klavye sensörleriyle çalışır.
- Odak görünürlüğü `:focus-visible` ile `--accent` konturludur.

## 7. Sunucu / Veri Akışı

### 7.1 Route yapısı

```
app/manage/
  login/page.tsx                     (public, AuthLayout)
  (panel)/
    layout.tsx                       oturum kontrolü + AdminShell
    page.tsx                         /manage genel bakış (+ ?panel= redirect'i)
    loading.tsx
    services/{page,loading}.tsx, services/new/page.tsx, services/[id]/{page,loading}.tsx
    products/…  projects/…  team/…  faq/…  posts/…      (aynı desen)
    home/{page,loading}.tsx, home/[key]/page.tsx, home/publish/page.tsx
    site-content/{page,loading}.tsx
    pages/{page,loading}.tsx
    site-settings/{page,loading}.tsx
    messages/{page,loading}.tsx, messages/[id]/page.tsx
    media/{page,loading}.tsx
    seo/{page,loading}.tsx
    audit/{page,loading}.tsx
  actions.ts                         oturum/çıkış eylemleri
  admin.css                          token seti
```

`(panel)/layout.tsx` oturumu bir kez çözer, yoksa `redirect("/manage/login")`; `AdminShell`'i render eder. `app/manage/layout.tsx` yalnızca `admin.css`'i ve `<html>` seviyesindeki gerekli sarmalayıcıyı sağlar.

### 7.2 Veri okuma

- `lib/content-model/collection-admin.ts` içine sayfalanmış ve alan seçimli yeni bir liste okuyucusu eklenir: `listCollectionPage(client, contentType, { page, perPage })` → `{ rows, total }`. `rows` yalnızca satırda gösterilen alanları taşır: `entityId`, `order`, `archived`, `createdAt`, dil başına durum, ve başlık/slug için **tek** bir gösterim alanı.
- Başlık/slug için revizyon payload'ının tamamı çekilmez. Payload'dan yalnızca gösterim alanlarını üretmek için `ContentTranslationRevision` üzerinde Prisma `select` ile `payload` yerine gerekli alanları çekmek mümkün değildir (payload `Json`); bu nedenle liste sorgusu yalnızca **varsayılan dilin** (tr, yoksa ilk mevcut dil) yayın/taslak revizyon payload'ını çeker ve diğer dillerden yalnızca işaretçi varlığını (`draftRevisionId`/`publishedRevisionId` boş mu) okur. Diğer üç dilin payload gövdeleri liste sorgusuna girmez.
- Mevcut `listCollectionEntities` çağrı yerleri yeni okuyucuya taşınır ve eski fonksiyon silinir.
- Düzenleme sayfası veriyi sunucu render'ında `getEntityEditView` ile çeker; istemciden `get…EditViewAction` çağrısı yapılmaz.

### 7.3 Mutasyonlar

- Sunucu eylemleri korunur. Her eylem yalnızca kendi route'unu ve etkilenen public yüzeyleri geçersiz kılar: `revalidatePath("/manage/<bölüm>")`, gerekiyorsa `revalidatePath("/manage/<bölüm>/<id>")` ve mevcut public path/tag çağrıları.
- `revalidatePath("/manage")` gibi kapsayıcı ve `?panel=` dönemine ait ölü çağrılar kaldırılır.
- Oluşturma eylemi `redirect("/manage/<bölüm>/<entityId>")` ile biter.
- Silme/arşivleme eylemi başarıdan sonra `redirect("/manage/<bölüm>")` ile biter.
- İstemci tarafında hiçbir yerde mutasyon sonrası `router.refresh()` çağrılmaz.

## 8. Şema, Migration ve Uyumluluk

Bu birim `prisma/schema.prisma`'ya dokunmaz ve migration üretmez. Veri okuma değişiklikleri yalnızca sorgu şeklindedir.

## 9. Route, Dil, Fallback ve SEO

- `/manage` ve altındaki tüm adresler `robots` tarafından indekslenmez (mevcut davranış korunur).
- Yönetim dili Türkçedir; içerik dili sekmelerle seçilir ve `?locale=` ile adrese yazılır.
- Public route'lar, canonical, hreflang, sitemap davranışı değişmez.
- `/manage?panel=…` adresleri 307 ile yeni route'lara yönlendirilir (kalıcı 308 değil: query-state adresler dış dünyaya yayınlanmadı, yalnızca yer imleri için geçiş kolaylığı).

## 10. Güvenlik ve Erişilebilirlik

- Oturum kontrolü sunucu tarafında `(panel)/layout.tsx` içinde; istemci tarafı kontrol dekoratiftir, güven sınırı değildir.
- Her mutasyon kendi içinde `AdminContext`'i yeniden çözer; layout kontrolüne güvenmez.
- Hata mesajları token/secret/SQL/stack trace sızdırmaz.
- Erişilebilirlik gereksinimleri §6.3'te tanımlıdır.

## 11. Kabul Kriterleri

1. **AC-1** `/manage/services`, `/manage/products`, `/manage/projects`, `/manage/team`, `/manage/faq`, `/manage/posts`, `/manage/media`, `/manage/seo`, `/manage/audit`, `/manage/messages`, `/manage/home`, `/manage/pages`, `/manage/site-content`, `/manage/site-settings` adreslerinin her biri doğrudan istekle 200 döner ve kendi içeriğini render eder.
2. **AC-2** `/manage?panel=services` isteği `/manage/services`'e yönlendirir; `/manage?panel=services&item=<id>` isteği `/manage/services/<id>`'ye yönlendirir.
3. **AC-3** "Yeni …" bir sunucu eylemi (form submit) olarak yeni varlık yaratır ve `redirect()` ile `/manage/services/<entityId>` adresine yönlendirir; adres çubuğunda gerçek id görünür. (Ayrı bir `/manage/services/new` GET route'u yerine form submit kullanılır: Next.js bir sayfa render'ı sırasında `revalidatePath` çağrısına izin vermez, bu yüzden oluşturma eylemi bir mutasyon olarak - `<form action={...}>` - tetiklenir, GET ile ziyaret edilebilir bir sayfa olarak değil.)
4. **AC-4** Düzenleme ekranı tam sayfadır: `EditorDrawer`, `PanelDrawer` ve `PanelLink` bileşenleri depoda mevcut değildir (`grep` kanıtlar).
5. **AC-5** Oturumsuz `/manage/posts` isteği `/manage/login`'e yönlendirir; oturumla 200 döner.
6. **AC-6** Bir liste sayfası açıldığında yürütülen Prisma sorgusu en fazla `perPage` (20) `ContentEntity` satırı döndürür ve yalnızca bir dilin revizyon payload'ını içerir.
7. **AC-7** Taslak kaydetme ve yayınlama işlemleri tek sunucu eylemi turuyla tamamlanır; ardından istemci kaynaklı ek bir `get…EditViewAction` veya tam sayfa `router.refresh()` isteği oluşmaz (dev sunucu logu kanıtlar).
8. **AC-8** ~~Her bölüm route'unun bir `loading.tsx` dosyası vardır~~ **Değiştirildi (uygulama sırasında bulundu):** `(panel)` altındaki hiçbir route `loading.tsx` kullanmaz. Next.js 16.3.4'te doğrulanmış bir hata var: bir route segmentinde `loading.tsx` bulunduğunda oluşan otomatik Suspense sınırı, soğuk (ilk) istekte hiç çözülmüyor ve ekran kalıcı olarak iskelet (skeleton) durumunda kalıyor - yalnızca bir Fast Refresh/HMR tetiklendiğinde düzeliyor. Bu, `(workspace)/layout.tsx`'in eski yorumunda zaten belgelenmiş aynı hata; bu birimde `loading.tsx` eklenince tekrar üretildi ve gerçek tarayıcıda "Liste yükleniyor" ekranında sonsuza kadar takılı kalan bir düzenleme sayfasıyla doğrulandı. Çözüm: `loading.tsx` tamamen kaldırıldı. Liste ve düzenleme sorguları zaten hızlı (ölçülen: 10-40ms) olduğu için sayfa sunucu tarafında tam render edilip tek parça HTML olarak gönderiliyor; ek bir bekleme durumu gerekmiyor.
9. **AC-9** Kenar çubuğu aktif bölümü `usePathname` ile işaretler; aktif öğe `aria-current="page"` taşır ve kırmızı işaret çubuğu görünür.
10. **AC-10** `/manage/login` iki panelli düzende render edilir; hatalı kimlik bilgisi form içinde hata kutusu gösterir ve oturum çerezi yazılmaz.
11. **AC-11** `app/manage/**` ve `components/admin/**` altında ham hex renk değeri (`#rrggbb`) kalmaz; tüm renkler token üzerinden gelir (`grep` kanıtlar; `admin.css` içindeki token tanımları istisnadır).
12. **AC-12** Dört dilli taslak/yayın akışı korunur: bir hizmete tr taslağı kaydedip yayınlamak `/servisler` sayfasında yayınlanan içeriği gösterir.
13. **AC-13** Medya seçme, sürükle-bırak sıralama, arşivleme/silme onayı ve zengin metin düzenleme yeni sayfa yapısında çalışır.
14. **AC-14** `npx tsc --noEmit`, `npx eslint .`, `npm run build` ve güncellenmiş test setleri geçer.

## 12. Kabul Kriteri → Test Eşlemesi

| AC | Doğrulama |
| --- | --- |
| AC-1 | `tests/e2e/spec-1-admin-routes.spec.ts` — her route için gezinme ve başlık kontrolü |
| AC-2 | Aynı dosya — legacy query adresinden yönlendirme kontrolü |
| AC-3, AC-12 | `tests/e2e/spec-1-editor-round-trips.spec.ts`, `tests/e2e/story-3-1-service-crud.spec.ts` — yeni kayıt → düzenle → yayınla → public doğrulama |
| AC-4 | `grep` taraması (kanıt: aşağıda §16) |
| AC-5, AC-10 | `tests/e2e/spec-1-admin-routes.spec.ts` |
| AC-6 | `tests/integration/spec-1-list-query.spec.ts` — `listCollectionPage` satır sayısı ve payload kapsamı |
| AC-7 | `tests/e2e/spec-1-editor-round-trips.spec.ts` — ağ isteklerinin sayımı (`page.on("request")`) |
| AC-8 | Kapsam dışı bırakıldı (§11 AC-8 notu) |
| AC-9 | `tests/e2e/spec-1-admin-routes.spec.ts`, `tests/e2e/story-1-2-admin-shell.spec.ts` |
| AC-11 | `grep` taraması (kanıt: aşağıda §16) |
| AC-13 | `tests/e2e/story-2-1-home-layout-reorder.spec.ts`, `story-4-rich-text-editor.spec.ts`, `story-6-3-contact-and-inbox.spec.ts`, medya/sıralama/arşiv testleri |
| AC-14 | Komut çıktıları (§16) |

## 13. Uygulama Sırası

1. **Token ve kabuk**: `admin.css` token seti, `components/admin/ui.ts`, `AdminShell`/`AdminSidebar`/`AdminTopbar`/`PageHeader`/`StatCard`/`SectionCard`/`StatusPill`/`Toast`/`DeleteButton`/`AuthLayout`/`Pagination`.
2. **Route grubu**: `(panel)/layout.tsx` (oturum + kabuk), `(panel)/page.tsx` (genel bakış + legacy redirect), `loading.tsx`.
3. **Veri okuma**: `listCollectionPage` + `getEntityEditView` kullanımının sayfalara taşınması.
4. **Koleksiyon bölümleri**: services, products, projects, team, faq, posts — liste + `new` + `[id]`.
5. **Tekil bölümler**: home, pages, site-content, site-settings, media, seo, audit, messages (+ `[id]`).
6. **Giriş ekranı**: `AuthLayout` ile `/manage/login`.
7. **Temizlik**: `(workspace)/`, `EditorDrawer`, `PanelDrawer`, `PanelLink`, `panel-types.ts`, `form-styles.ts`, `listCollectionEntities`, ölü `revalidatePath` çağrıları.
8. **Testler**: 61 `?panel=` referansının güncellenmesi + yeni spec testleri.
9. **Doğrulama**: typecheck, lint, testler, build, tarayıcıda uçtan uca akış.

## 14. Riskler, Geri Alma ve Koruma Kuralları

- **Risk:** Drawer'dan sayfaya taşırken düzenleyici bileşenlerinin state yönetimi bozulabilir. **Önlem:** düzenleyici bileşenlerinin iç yapısı değiştirilmez; yalnızca sarmalayıcı ve veri girişi değişir.
- **Risk:** 61 test referansı toplu değiştirilirken test niyeti bozulabilir. **Önlem:** her test dosyası tek tek gözden geçirilir; yalnızca adres kontratı güncellenir, iddia (assertion) niyeti korunur.
- **Risk:** Sayfalanmış liste sorgusu sıralama davranışını bozabilir. **Önlem:** sıralama yalnızca görüntülenen sayfa içinde geçerlidir ve `order` alanı global kalır; sıralama eylemi mevcut `adminReorderEntities` mantığını kullanır.
- **Geri alma:** Bu birim tek commit setinde uygulanır; geri alma `git revert` ile mümkündür. Şema değişmediği için veri geri alma gerekmez.
- **Koruma:** Public bileşenler, `lib/**` iş mantığı, `prisma/**` ve `.env` bu birimde değiştirilmez.

## 15. Definition of Done

1. §11'deki 14 kabul kriteri sağlanır.
2. Yönetim panelinde hiçbir rutin akış drawer/modal içinde kalmaz (medya seçici ve onay diyaloğu istisnadır).
3. Panel görünümü wpfuk referansının token seti, kabuk düzeni ve bileşen desenleriyle örtüşür.
4. Tarayıcıda gerçek akış kanıtlanır: giriş → genel bakış → koleksiyon listesi → yeni kayıt → dil sekmesi → taslak → yayınla → public sayfa.
5. `npx tsc --noEmit`, `npx eslint .`, testler ve `npm run build` geçer.
6. `docs/context/progress-tracker.md` gerçek durumu yansıtır.

## 16. Uygulama Kanıtı

**Dizin/branch/SHA:** `/Users/berat/extech`, branch `main`, SHA `bdccb668cb3414eaaaef62d5518a05215eaccf40`.

**Not — port 3000 çakışması:** Yerel testler sırasında port 3000'in kullanıcının ilgisiz başka bir projesi (`/Users/berat/anton/lamia`) tarafından işgal edildiği bulundu; bu extech'in kodunda değil. Doğrulama `npm run dev -- --port 3900` ile ayrı bir portta yapıldı; `curl http://127.0.0.1:3900/api/dev-tools/server-identity` doğru `workingDirectory`/`gitSha` döndürdüğü teyit edildi.

**Komutlar:**
- `npx tsc --noEmit` → 0 hata.
- `npx eslint .` → 0 hata, 52 önceden var olan `<img>` uyarısı (bu birimle ilgisiz).
- `npm run build` → başarılı; `/manage`, `/manage/<bölüm>`, `/manage/<bölüm>/[id]`, `/manage/home/[key]`, `/manage/home/publish`, `/manage/messages/[id]` dahil tüm route'lar derlendi.
- `npx playwright test` (tam e2e seti, port 3900) → **83 geçti, 1 atlandı** (`AC-1.1-06` yalnızca production'da; `NODE_ENV` gerektirir), **0 başarısız**.
- `npx playwright test --config=playwright.contract.config.ts` (unit + `tests/integration/spec-1-list-query.spec.ts`) → 11 geçti.

**Gerçek tarayıcı akışı (bu oturumda `browser` aracıyla bizzat sürüldü):**
1. `/manage/login` → gerçek kimlik bilgisiyle giriş → `/manage` genel bakış.
2. `/manage/services` → "Yeni hizmet" → `/manage/services/<entityId>` (form submit + `redirect()`, adres çubuğunda gerçek id).
3. Başlık/slug/özet dolduruldu, blok eklendi → "Taslağı kaydet" → `TR taslağı kaydedildi.` → "Bu dili yayınla" → `TR yayınlandı.`
4. `/servisler/e2e-deneme-b1b348` → yayınlanan başlık gerçek tarayıcıda göründü (ekran görüntüsüyle doğrulandı), sonra test verisi temizlendi.
5. `/manage/home/brandTrust?locale=tr`, `/manage/home/publish`, `/manage/messages/<id>`, `/manage/pages?locale=en`, `/manage/site-settings?locale=en` → hepsi tam sayfa, hatasız render.
6. Mobil genişlikte (390px) kenar çubuğu `role="dialog"` ile açıldı, `aria-current="page"` aktif öğeyi işaretledi.

**Bulunan ve düzeltilen gerçek hatalar (spec yazılırken bilinmiyordu):**
- **Next.js 16.3.4 cold-load Suspense hatası** (AC-8 kapsam dışı bırakıldı): `(panel)` altına eklenen her `loading.tsx`, ilk (soğuk) istekte hiç çözülmeyen bir Suspense sınırı oluşturdu; `/manage/services/<id>` gerçek tarayıcıda kalıcı olarak "Liste yükleniyor" iskeletinde kaldı. Sadece bir Fast Refresh sonrasında düzeliyordu — tam olarak önceki ekibin `(workspace)/layout.tsx` yorumunda belgelediği hata. Tüm `loading.tsx` dosyaları kaldırılarak çözüldü.
- **Oluşturma route'u render sırasında `revalidatePath` çağırıyordu**: `/manage/<bölüm>/new` bir GET sayfası olarak `createXAction()`'ı çağırıp `redirect()` ediyordu; Next.js bunu "render sırasında revalidatePath" hatası olarak reddetti. Çözüm: oluşturma bir `<form action={createXAction}>` submit'ine çevrildi (`CreateRecordButton`), `new/` route'ları silindi.
- **Mesaj durum çakışması sonrası kalıcı kilitlenme**: `runStatusUpdate` yalnızca başarı durumunda `revalidatePath` çağırıyordu; bir CAS çakışmasından sonra sayfa yenilenmediği için gizli `expectedVersion` alanı bayat kalıyor ve her tekrar deneme yeniden çakışıyordu. Çözüm: `revalidatePath` her iki durumda da çağrılır.
- **Test seçicileri**: dnd-kit'in kendi `role="status"`/canlı bölgesi ve Next'in `__next-route-announcer__` (`role="alert"`) öğesi, artık drawer'ın izole etmediği düz sayfa seviyesinde `getByRole("alert")`/`getByRole("status")` sorgularıyla çakışıyordu (strict-mode ihlali). Etkilenen testler `p[role="status"]`/`p[role="alert"]` veya `.filter({ hasText })` ile daraltıldı.

**Silinen dosyalar:** `app/manage/(workspace)/{layout,page}.tsx`, `components/admin/{EditorDrawer,PanelDrawer,PanelLink,panel-types}.tsx/.ts`, tüm `app/manage/(panel)/**/loading.tsx`, `app/manage/*/new/page.tsx` (6 domain), eski `_bmad*`/`.agents/skills` (önceki oturumda).

**Güncellenen testler:** `spec-1-admin-routes.spec.ts`, `spec-1-editor-round-trips.spec.ts` (yeni), `tests/integration/spec-1-list-query.spec.ts` (yeni), `story-1-2-admin-shell.spec.ts`, `story-1-3-audit.spec.ts`, `story-3-1-service-crud.spec.ts`, `story-3-about-and-orphan-fields.spec.ts`, `story-4-rich-text-editor.spec.ts`, `story-5-dev-seed-and-fallback.spec.ts`, `story-6-3-contact-and-inbox.spec.ts`; `story-1-2-unified-workspace.spec.ts` ve `editor-panel-refresh-regression.spec.ts` silindi (eski drawer sözleşmesini sabitliyorlardı, yeni davranışa yeniden pinlenmedi).
