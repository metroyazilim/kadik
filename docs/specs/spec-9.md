# Spec 9 — Tüm Sayfalar Listesi ve Evrensel Page Builder

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-9 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 7 ve Spec 8 tamamlanmış olmalıdır  
**Paralellik:** Tek başına uygulanır; `/manage/pages`, section editörleri ve page actions bu birimin tek sahibidir

## 1. Hedef

`/manage/pages` yalnız Hakkımızda formu olmaktan çıkar. Public sitedeki bütün kompozisyon sayfalarını listeleyen, her sayfaya reusable section ekleyebilen, aynı section'ı başka sayfalarda kullanabilen ve page/layout/locale yayın durumunu açıkça gösteren gerçek bir Page Builder olur.

Mevcut admin CSS/deseni korunur. Kullanıcının referans ekranlarındaki modern içerik hiyerarşisi alınır: liste + arama, iki kolonlu editör, açık kart/accordion, sağda bağlamsal yayın paneli. Başka projenin mock state'i veya stilleri kopyalanmaz.

## 2. Görünür Sonuç

- `/manage/pages` Home, Hakkımızda ve yönetilen diğer tüm statik/indeks sayfalarını tek tabloda gösterir.
- `/manage/pages/[pageId]?locale=tr` sayfa başlığı/route alanları, section canvas'ı ve yayın panelini gösterir.
- Kullanıcı section eklerken iki seçenek görür: “Yeni section oluştur” ve “Kütüphaneden yeniden kullan”.
- Section kartları sürükle-bırak ve klavye ile sıralanır, açılıp kapanır.
- Hakkımızda'nın collage, deneyim, sunduklarımız, ikonlar, alt başlıklar, istatistik, müşteriler, ödüller, içerik ve SEO alanları ayrı ve anlaşılır section kartlarıdır.
- Geniş ekranda kısa alanlar grid/kolon; mobilde tek kolon.
- Ortak section düzenlenirken onu kullanan sayfalar görünür; değişikliğin fan-out etkisi gizlenmez.

## 3. Sayfa Kapsamı

### 3.1 Page Builder'da listelenen kayıtlar

ManagedPage kayıtları en az şu public yüzeyleri kapsar:

- Anasayfa (`home`, sistem sayfası)
- Hakkımızda
- Hizmetler indeks sayfası
- Projeler/İşler indeks sayfası
- Blog indeks sayfası
- İletişim
- SSS
- Çalışma Sürecimiz
- Kurumsal Destek
- Kariyer
- Fiyatlandırma
- Misyon & Vizyon veya yasal sayfalar ayrı public route ise her biri

Yeni bir statik landing page kullanıcı tarafından oluşturulabilir. Teknik koleksiyon detayları (`service`, `project`, `post`, `team` kayıtları) Page Builder'da ayrı page kayıtları olarak çoğaltılmaz; ilgili koleksiyon editöründe kalır. Ancak bunların ortak **detail template** sayfaları ManagedPage olarak listelenebilir ve `collection-detail` section'ı kullanabilir.

“Bütün sayfalar” görünürlüğünün ikinci yarısı Spec 11 SEO Center'dadır: ContentRoute registry'deki her gerçek public URL orada listelenir. Bu ayrım sayesinde yüzlerce blog kaydı Page Builder listesinde sahte statik sayfa olmaz.

### 3.2 Liste satırı

- Sayfa adı ve locale başlığı.
- Kanonik TR path + aktif locale path özeti.
- Tür: Sistem, Statik, Koleksiyon İndeksi, Detay Şablonu.
- Dört locale için Eksik / Taslak / Yayında.
- Layout: Taslak değişiklik var / Yayında.
- Section sayısı ve yeniden kullanılan section sayısı.
- Son güncelleme.
- “Düzenle” gerçek linki.

Liste 20 kayıt/sayfa, `?page=&q=&status=&type=` server-side filtreleme kullanır. Revision payload gövdeleri liste sorgusuna girmez.

## 4. Route Kontratı

| Route | Davranış |
| --- | --- |
| `/manage/pages` | sayfalanmış tüm ManagedPage listesi |
| `/manage/pages/[pageId]` | varsayılan `locale=tr` page builder |
| `/manage/pages/[pageId]?locale=en` | EN page/section içerik düzenleme |
| `/manage/pages/[pageId]/preview?locale=tr` | taslak page + draft layout önizleme; auth zorunlu, noindex |
| `/manage/sections` | reusable section kütüphanesi |
| `/manage/sections/[sectionId]?locale=tr` | tek reusable section editörü ve kullanım raporu |

Yeni sayfa oluşturma `CreateRecordButton` form action desenini kullanır; render sırasında mutation yapan `/new` GET route'u kullanılmaz. Oluşturma sonrası `/manage/pages/<id>` adresine redirect edilir.

## 5. Page Builder Yerleşimi

### 5.1 Üst bölüm

- `PageHeader`: geri linki, internal page adı, path, aktif locale durumu.
- Locale tabs: TR/EN/RU/AR; durum pill'leri.
- Aksiyonlar: “Önizle”, “Taslağı kaydet”, “Bu dili yayınla”, “Layout'u yayınla”.
- Page content publish ile layout publish ayrı pointer'lardır ve UI bunu açıkça anlatır.

### 5.2 Masaüstü

`EditorPageLayout`:

- **Ana kolon:** Sayfa Kimliği accordion'u + Section Canvas.
- **Sağ panel:** locale yayın durumu, route/slug özeti, layout durumu, section eksikliği, kullanım/önizleme, save/publish düğmeleri.
- Sağ panel tüm formu kaplamaz; 320–360px.
- Canvas genişliği section alanlarının iki/üç kolon grid kullanmasına izin verir.

### 5.3 Mobil

- Önce başlık ve locale.
- Sonra yayın/eksik durum özeti.
- Sonra section canvas.
- Kaydetme/yayınlama sticky ekran altı bar yapmazsa sayfa sonunda açıkça tekrar edilir; içerik üstünü kapatan fixed bar yasaktır.
- Sürükle-bırak için klavye ve move up/down erişilebilir alternatifleri korunur.

## 6. Sayfa Kimliği Kartı

Alanlar:

- Admin adı (`ManagedPage.name`, lokalize değil).
- Public başlık, eyebrow, özet/açıklama (locale revision payload).
- Slug/route segmenti; Home için kilitli root.
- Navigasyonda gösterim bu kartın konusu değildir; Site Ayarları navigasyon sahibi olmaya devam eder.
- Page türü ve system flag salt okunur.
- SEO özeti bu spec'te mevcut title/description alanlarını gösterebilir; gelişmiş SEO editörü Spec 11'e bırakılır.

Route collision server tarafında `ContentRoute` registry ile doğrulanır. Slug değişikliği publish edilmeden public route değişmez.

## 7. Section Canvas

Her placement kartı:

- Drag handle, sıra, section adı, kind etiketi.
- “Ortak” badge'i ve kullanım sayısı; tek kullanımlıysa “Bu sayfaya özel”.
- Locale taslak/yayın durumu.
- Enable/disable switch'i; layout draft'ını değiştirir, public'i layout publish'e kadar etkilemez.
- Accordion body içinde registry kind'ına özgü editör.
- İşlemler: Önizle, Kütüphanede aç, Çoğalt ve bu placement'a geçir, Sayfadan kaldır.
- “Sil” placement kartında bulunmaz; section fiziksel silme Spec 14 Developer Mode akışıdır.

### 7.1 Sıralama

- dnd-kit pointer + keyboard sensor.
- Order input gösterilmez.
- Sıra değişikliği yalnız page layout draft revision yaratır.
- Bir kaydetmede tek yeni layout revision; drag başına sunucu mutation yoktur.
- Optimistic UI hata alırsa önceki sıra geri yüklenir ve toast gösterilir.

### 7.2 Yeni section oluştur

1. Registry kataloğundan kind seçilir.
2. Internal ad girilir; default ad sayfa + kind'tan önerilir.
3. Server action section entity + aktif locale draft + yeni layout draft'ını tek transaction'da yaratır.
4. Oluşan kart açılır ve ilk zorunlu alana odaklanır.

### 7.3 Kütüphaneden yeniden kullan

- Modal yerine geçici seçim yüzeyi olduğu için erişilebilir dialog kullanılabilir; route `/manage/sections` ayrıca tam sayfa kütüphanedir.
- Arama, kind ve kullanım filtreleri.
- Aktif locale published/draft/eksik durumu.
- Hangi sayfalarda kullanıldığı özetlenir.
- Arşivli section seçilemez.
- Seçim yalnız placement ekler; section içeriğini kopyalamaz.

### 7.4 Çoğalt

- Tüm locale draft/published kaynakları new section draft'ına kopyalanırken published pointer üretilmez. Clone her dilde taslak olur; kullanıcı incelemeden public'e çıkmaz.
- Medya ID'leri paylaşılır, medya dosyası kopyalanmaz.
- Internal ad benzersiz ve düzenlenebilir öneri alır.

## 8. Section Editörleri

Tüm editörler `EditorSection` + `FieldGrid` kullanır. Registry payload schema tek doğrulama kaynağıdır.

### 8.1 About zorunlu organizasyonu

Hakkımızda editörü migration sonrası en az şu kartları ayrı gösterir:

1. **Sayfa Bannerı:** eyebrow, başlık, açıklama/breadcrumb metni.
2. **Giriş İçeriği:** başlık parçaları, intro/body, CTA varsa.
3. **Görsel Collage:** primary, secondary, accent medya seçimleri; her kullanım için locale alt/caption.
4. **Deneyim Rozeti:** `experienceValue`, `experienceUnit`, caption. Değer + birim aynı satır.
5. **İstatistikler:** tekrar eden kart grid'i; sürüklenebilir item'lar.
6. **Sunduklarımız:** bölüm eyebrow/başlık/alt başlık; her item için ikon anahtarı, başlık, açıklama. Kullanıcı teknik SVG/React adı yazmaz; ikon katalogdan seçilir.
7. **Müşteriler/Logolar:** medya seçimi, alt/caption ve sıra.
8. **Ödüller:** başlık, medya, yıl/etiket alanları.
9. **Uzun İçerik:** bodyTitle + Tiptap body.
10. **SEO Özeti:** otomatik başlık/açıklama preview; gelişmiş override için Spec 11 linki.

Bu alanlar tek dev About payload'a geri birleştirilmez; gerçek ReusableSection payload'larıdır.

### 8.2 Kind bazlı alan davranışı

- `media-collage`: sabit slotlar registry tanımından gelir; boş slot ayrı durum gösterir.
- `feature-list`, `stat-grid`, `process-steps`, `testimonials`: item DnD, keyboard, add/remove confirm.
- `collection-feed`: content type katalogdan seçilir; limit min/max server validation; manuel entity seçkisi varsa IDs relation/dependency servisinde izlenir.
- `rich-text`: Tiptap çıktı write ve render sınırında sanitize edilir.
- `hero`: görünür label “Hero Section”; teknik `kind="hero"`.
- `logo-cloud`: MediaAsset kullanır; dış URL yasak.

## 9. Reusable Section Kütüphanesi

`/manage/sections`:

- Arama, kind, kullanım (kullanılmıyor/tek/çoklu), durum (aktif/arşivli).
- Kart veya tablo görünümünde internal ad, kind, dört locale statüsü, kullanım sayısı, updatedAt.
- “Kullanılmıyor” section'lar açıkça işaretlenir.
- Edit route tek section içeriğini gösterir; sağ panelde draft/published kullanan sayfalar linklenir.
- Ortak section publish onayında “Bu değişiklik şu N yayınlanmış sayfayı etkiler” listesi görünür.
- Archive yalnız kullanılmayan section için doğrudan; kullanımdaysa dependency report ve engel.

## 10. Server Action Sınırı

- Page form istemciden tek doğrulanmış intent gönderir; bütün nested payload'a kör güvenilmez.
- Section içerik save'i ve layout save'i ayrı optimistic version taşır. Birinin çatışması diğerini sessizce ezmez.
- Sayfa kaydetme tüm açık section'ları gereksiz yere yeni revision yapmaz. Yalnız dirty section'lar save edilir; başarısız çoklu save partial state bırakmamalıdır. Tercih: dirty section revision'ları + page revision + layout revision tek transaction; payload boyutu sınırlandırılır.
- Büyük medya upload form action içine sokulmaz; mevcut upload ticket akışı korunur.
- Publish eylemi, eksik locale/invalid section listesiyle structured error döner.

## 11. Önizleme

- Auth zorunlu, `robots: noindex, nofollow`.
- Draft page revision + draft layout + section draft'larını çözer; draft yoksa aynı locale published pointer kullanılabilir ve UI preview badge'i bunun fallback olduğunu söyler.
- Locale'ler arası fallback yoktur.
- Preview URL tahmin edilemeyen token gerektirmez çünkü session kontrolü vardır; response cache public ile paylaşılmaz.
- Public renderer component'leri kullanılır; ikinci preview markup sistemi yazılmaz.

## 12. Dosya Sahipliği

- `app/manage/(panel)/pages/**`
- `app/manage/(panel)/sections/**` (yeni)
- `components/admin/page-builder/**` (yeni)
- `components/admin/sections/**` (kind editörleri)
- Page/section admin query ve actions
- `components/admin/AdminSidebar.tsx` yalnız “Sections/Kesitler” linki için
- Preview route/adaptörü

Bu birim Prisma modellerini değiştirmez; Spec 8 kontratını kullanır. Yeni section kind ihtiyacı bulunursa Spec 8 registry'sine küçük, açık schemaVersion artışı yapılır ve aynı terminal sahiplenir.

## 13. Kabul Kriterleri

1. **AC-9.1** `/manage/pages` yalnız About formu göstermez; bütün ManagedPage kayıtlarını sayfalanmış/filtrelenebilir listeler.
2. **AC-9.2** Home, About ve en az bir indeks sayfası gerçek `/manage/pages/[id]` edit route'unda açılır.
3. **AC-9.3** About alanları §8.1'deki ayrı accordion section'lar olarak görünür; collage/deneyim/sunduklarımız/SEO tek belirsiz uzun form değildir.
4. **AC-9.4** 1440px'te page editor ana + sağ panel ve ilişkili alan grid'leri kullanır; 390px'te yatay overflow olmadan tek kolon olur.
5. **AC-9.5** Kullanıcı yeni section oluşturabilir, mevcut section'ı reuse edebilir ve clone ederek bağımsızlaştırabilir; üç davranışın kimlik sonuçları farklıdır.
6. **AC-9.6** Aynı section iki sayfada kullanıldığında her kart ve publish onayı kullanım etkisini gösterir.
7. **AC-9.7** Section reorder/enable/remove yalnız layout draft'ını değiştirir; layout publish'e kadar public sayfa değişmez.
8. **AC-9.8** dnd-kit sıralama pointer ve klavye ile çalışır; order input yoktur.
9. **AC-9.9** Page/section dirty save optimistic version kullanır; eşzamanlı değişiklik ikinci kullanıcının verisini ezmez.
10. **AC-9.10** Draft preview public renderer ile çalışır, oturumsuz istek login'e yönlenir ve response noindex'tir.
11. **AC-9.11** Liste sorgusu revision payload gövdelerini çekmez ve en fazla 20 page satırı döndürür.
12. **AC-9.12** “Gönderiler” ve “Kahraman Section” UI metni yoktur; Blog/Yazılar ve Hero Section görünür.
13. **AC-9.13** Mevcut public Home/About görünümü ve locale publish semantiği değişmez.

## 14. Test ve Gerçek Doğrulama

### Kalıcı davranış testleri

- Reuse vs clone kimliği ve fan-out.
- Layout draft/publish ayrımı.
- Optimistic conflict.
- List query payload sınırı.
- Preview auth/noindex/draft resolution.
- About section payloadlarının alan kaybı olmadan round-trip'i.

### Browser senaryosu

1. `/manage/pages` → About → TR.
2. Collage ve deneyim section'larını aç, kısa alanların aynı satırda olduğunu gör.
3. Bir test `cta` section'ı yarat, taslağı kaydet, preview'da gör; public'te görünmediğini doğrula.
4. Layout'u yayınla; public About'ta CTA'yı gör.
5. CTA'yı Home'a reuse et; usage sayısı 2 olsun.
6. CTA metnini publish et; iki sayfada değişsin.
7. About placement'ını clone'a geçir; clone'u değiştir; Home değişmesin.
8. Test verisini tamamen temizle.
9. Aynı akışı 1440px ve 390px görünümde temel ekran görüntüleriyle doğrula.

### Komutlar

- `npx tsc --noEmit`
- `npx eslint .`
- ilgili integration ve E2E testleri
- `npm run build`

## 15. Riskler

- **Form payload büyüklüğü:** Tüm section'ları her save'de göndermek gecikme ve conflict yaratır. Yalnız dirty section intent'leri gönderilir.
- **Ortak section sürprizi:** Reuse etkisi badge + usage list + publish onayıyla görünürdür.
- **Accordion state kaybı:** Kapanan section form state'i korunur; locale/page değişiminde dirty guard vardır.
- **Preview güvenliği:** Draft endpoint public cache veya metadata üretimine sızmaz.
- **Alan duplikasyonu:** Page-level başlık ile hero başlığı farklı rollerdir; etiket/açıklama bunu açıklar, otomatik birbirine kopyalamaz.
- **Aşırı soyut editör:** Her kind'ın typed editörü vardır; “her şeyi JSON ile düzenle” geri gelmez.

## 16. Definition of Done

- Tüm ManagedPage kayıtları listeden erişilebilir ve gerçek edit route'unda düzenlenebilir.
- About açık section hiyerarşisine ayrılmıştır.
- Reuse, clone, reorder, enable ve preview davranışları gerçek admin→public akışta kanıtlanmıştır.
- Geniş/mobil düzen erişilebilir ve mevcut tokenlarla uyumludur.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- `project-overview.md`, `ui-context.md` ve `progress-tracker.md` uygulanmış duruma göre güncellenmiştir.
