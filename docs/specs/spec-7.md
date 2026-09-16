# Spec 7 — Yönetim Bilgi Mimarisi, Ayar Merkezi ve Düzenleyici Yerleşimi

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-7 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Başlangıç SHA:** Uygulama başında kaydedilir; spec yazım SHA'sı `bdccb66`  
**Bağımlılık:** Spec 1 tamamlanmış olmalıdır  
**Sonraki birimler:** Spec 8 ve Spec 9 bu birimdeki düzenleyici primitiflerini kullanır  
**Görsel referans:** Kullanıcının ilettiği modern Metro admin ekranları ve `/Users/berat/dr-murat-admin-ui`; yalnızca yerleşim/desen referansıdır, mock veri veya ikinci tasarım sistemi kopyalanmaz

## 1. Problem

Mevcut yönetim paneli aynı tasarım tokenlarını kullansa da içerik organizasyonu zayıftır:

- `AboutEditorPanel`, `SiteSettingsEditor` ve `SiteContentEditor` geniş ekranda dahi uzun, tek kolonlu formlardır.
- `/manage/site-content` ham JSON textarea sunar; alanın amacı ve etkilediği public yüzey editörden anlaşılmaz.
- Site ayarlarında marka, navigasyon, iletişim, varsayılan SEO, misyon/vizyon ve yasal metinler tek akışta birbirine karışır.
- Aynı form grubu için birden fazla kart/accordion yaklaşımı oluşmaya başlamıştır.
- Yönetim terminolojisi public ürün diliyle tutarsızdır: “Gönderiler” yerine “Blog / Yazılar”, “Kahraman Section” yerine “Hero Section” kullanılmalıdır.

## 2. Karar ve Görünür Sonuç

Mevcut CSS tokenları ve yönetim kabuğu korunur. Yeni bir tasarım sistemi kurulmaz. İçerik yalnızca daha anlaşılır bir bilgi mimarisine ve duyarlı kolon/grid yerleşimine taşınır.

Tamamlandığında:

1. Geniş ekranda düzenleyiciler `ana içerik + bağlam/işlem paneli` veya `kategori listesi + aktif ayar formu` düzeninde çalışır.
2. Alan grupları erişilebilir accordion/kartlar halinde açılır; bir kullanıcı sayfanın tamamını kaydırmadan ilgili gruba ulaşır.
3. Site İçeriği ham JSON göstermez. Bilinen sözlük alanlarını etiketli, tipli form kontrolleriyle düzenler.
4. Site Ayarları bir “Ayar Merkezi” olur: Genel, Navigasyon, İletişim, Sosyal, Misyon & Vizyon, Yasal, Varsayılan SEO ve Gelişmiş başlıkları ayrı kartlardır.
5. Mobilde kolonlar tek kolona iner; sabit/taşan yan panel oluşmaz.
6. Sol menü ve ekran başlıklarında “Blog / Yazılar” ve “Hero Section” terminolojisi kullanılır.

## 3. Kapsam

### 3.1 Kapsam içi

- Mevcut `admin.css` tokenlarına dayanan ortak düzenleyici yerleşim primitifleri.
- `SectionCard` bileşeninin tek accordion kontratı haline getirilmesi veya aynı API'yi sağlayan `EditorSection` ile temiz biçimde değiştirilmesi.
- `/manage/site-settings` bilgi mimarisi ve duyarlı yerleşimi.
- `/manage/site-content` ham JSON textarea yerine şema güdümlü tipli form.
- Koleksiyon düzenleyicilerinde ortak sağ panel: yayın durumu, dil, öne çıkan görsel ve işlem düğmeleri; yalnızca tekrar eden mevcut alanlar taşınır.
- Navigasyon ve görünür metinlerde adlandırma düzeltmeleri.
- Form erişilebilirliği, odak, klavye ve hata özeti.

### 3.2 Kapsam dışı

- Prisma şeması, migration ve içerik saklama biçimi.
- Reusable section/page builder; Spec 8 ve Spec 9 kapsamıdır.
- Çeviri JSON dışa/içe aktarma; Spec 10 kapsamıdır.
- SEO veri kontratını genişletmek; Spec 11 kapsamıdır.
- Yetki, kullanıcı ve profil; Spec 12 kapsamıdır.
- Public sitenin görsel tasarımını değiştirmek.
- `/manage/site-content` route'unu kaldırmak. Kullanıcı yeni görünümü değerlendirecek; kaldırma ayrı ve açık bir karar olmadan yapılmaz.

## 4. Korunacak Kurallar

- `app/manage/admin.css` içindeki mevcut token seti tek görsel kaynaktır; yeni ham hex renk yazılmaz.
- Her rutin düzenleme gerçek route üzerinde tam sayfa kalır. Drawer kullanılmaz. Medya seçici ve yıkıcı onay diyaloğu istisnadır.
- Mevcut server action ve taslak/yayın semantiği korunur.
- Mutasyon sonrası `router.refresh()` eklenmez.
- `(panel)` altında `loading.tsx` eklenmez; Next.js 16.3.4 soğuk Suspense problemi geçerlidir.
- Reference projedeki statik/mock kullanıcılar, veri dizileri, class yığınları ve uygulama durumu kopyalanmaz.

## 5. Ortak UI Kontratı

### 5.1 `EditorPageLayout`

Yeni ortak yerleşim `components/admin/EditorPageLayout.tsx` altında tanımlanır:

- `header`: `PageHeader`.
- `main`: birincil form içeriği.
- `aside`: yayın, durum, dil, medya veya bağlamsal yardım kartları.
- Genişlik: `xl` ve üzerinde yaklaşık `minmax(0, 1fr) 320px`; altında tek kolon.
- `aside` geniş ekranda sticky olabilir fakat viewport yüksekliğini aşan içerik kendi doğal sayfa akışında kalır; nested scroll container oluşturulmaz.
- Form tek `<form>` ise `main` ve `aside` aynı form ağacında kalır; ayrı formlar aynı submit sonucunu taklit etmez.

### 5.2 `EditorSection`

Tek accordion/kart kontratı:

- Props: `id`, `title`, `description?`, `icon?`, `defaultOpen?`, `status?`, `children`.
- Tercih: semantik `<details>/<summary>`; mevcut animasyon gereksinimi yoktur.
- `summary` klavye ile açılır, `aria-expanded` tarayıcı semantiğinden gelir.
- Form doğrulama hatası bulunan kapalı bölüm otomatik açılır ve ilk hataya odaklanır.
- Başlıkta bölüm durumu gösterilebilir: “Eksik”, “Taslak”, “Tamam”. Durum yalnızca dekoratif renge dayanmaz.
- Bölüm kapalıyken mevcut input state'i kaybolmaz. İçerik kaldırılıp yeniden mount edilmez; yalnızca ağır editörler ileride Spec 15'te lazy mount edilebilir.

### 5.3 `FieldGrid`

- `sm`: tek kolon.
- `md`: iki eş alan.
- `xl`: alan tanımı açıkça üç kolon istiyorsa üç kolon.
- Başlık/açıklama gibi geniş alanlar `span="full"` kullanır.
- İstatistik değer/birim, adres şehir/ülke, SEO başlık/açıklama sayaçları gibi ilişkili alanlar aynı satırda tutulur.

### 5.4 `SettingsCategoryNav`

- Masaüstünde sol kategori listesi, sağ aktif form.
- Mobilde yatay taşmayan select veya üst üste kategori düğmeleri.
- Aktif kategori URL'de `?section=<key>` ile temsil edilir; yenileme ve geri tuşu çalışır.
- Geçersiz key güvenli biçimde `general` kategorisine döner.

### 5.5 Kaydetme ve hata yüzeyi

- Sayfanın üstünde alan adı + bölüm adı içeren hata özeti bulunur.
- Alan yanında mevcut doğrulama hatası korunur.
- Başarı/hata yalnızca toast ile gösterilir; tablo/form akışına rastgele durum paragrafı eklenmez.
- Kaydetme sırasında düğme pending olur ve çift submit engellenir.
- Dil değiştirirken kaydedilmemiş değişiklik varsa açık uyarı gösterilir; sessiz veri kaybı olmaz.

## 6. Site Ayarları Bilgi Mimarisi

`/manage/site-settings?locale=<locale>&section=<section>` şu kategorilere ayrılır:

| Key | Başlık | Mevcut alanlar |
| --- | --- | --- |
| `general` | Genel | site adı, açıklama, slogan, logo ve temel marka alanları |
| `navigation` | Navigasyon | header bağlantıları, CTA etiketi/hedefi, footer kolonları |
| `contact` | İletişim | adres, telefon, e-posta, harita/iletişim metinleri |
| `social` | Sosyal hesaplar | platform + URL satırları |
| `mission-vision` | Misyon & Vizyon | başlıklar ve uzun metinler |
| `legal` | Yasal metinler | gizlilik, KVKK, çerez, kullanım metinleri; her belge kendi accordion'u |
| `default-seo` | Varsayılan SEO | mevcut varsayılan başlık/açıklama/OG görseli; gelişmiş alanlar Spec 11'de eklenir |
| `advanced` | Gelişmiş | yalnızca gerçekten var olan teknik ayarlar; Developer Mode Spec 14'te role ve tekrar doğrulama ile eklenir |

Kurallar:

- Sol kategori değiştirmek sunucudan bütün formu tekrar istemez; mevcut locale verisi sayfa render'ında gelir, istemci yalnız aktif kategori görünümünü değiştirir.
- Her kategoride hangi public yüzeylerin etkilendiği bir cümleyle yazılır.
- Yasal metinler Tiptap kullanır; tek sayfada tüm Tiptap örnekleri aynı anda açılmaz. İlk etapta yalnız aktif kategori mount edilir.
- Site ayarı payload şeması bu spec'te değişmez.

## 7. Site İçeriği Formu

`SiteContentEditor` ham JSON textarea'yı bırakır fakat mevcut sözlük okuma/yazma servislerini kullanır.

### 7.1 Alan kataloğu

- Mevcut dictionary anahtarları kod tarafında kapalı bir `siteContentFieldRegistry` ile tanımlanır.
- Her tanım: `path`, `label`, `description`, `control` (`text`, `textarea`, `url`, `list`, `richText`), `group`, `required`, `publicSurfaces`.
- Kullanıcı JSON key'lerini görmez veya değiştirmez.
- Katalogda olmayan mevcut bir key veri kaybına uğramaz: form onu “Tanımsız alanlar” salt-okunur tanı listesinde gösterir ve kaydetme payload'ından silmez.
- Yeni key eklemek registry + doğrulama değişikliği gerektirir; serbest anahtar üretimi yoktur.

### 7.2 Gruplar

- Genel arayüz metinleri.
- Header ve footer etiketleri.
- Form etiketleri ve doğrulama metinleri.
- Koleksiyon boş durumları.
- Sistem/SEO yardımcı metinleri.

Site İçeriği ile Site Ayarları arasında aynı alan iki yerde düzenlenemez. Mevcut bir alanın gerçek sahibi belirlenir; diğer ekrandaki kopya kaldırılır ve veri taşınmadan tek kaynağa bağlanır.

## 8. Koleksiyon Düzenleyici Yerleşimi

Hizmet, ürün, proje, ekip, SSS ve blog editörleri aynı iskeleti kullanır:

- Ana kolon: Temel Bilgiler, İçerik, Medya/Galeri, tipe özel alanlar, Gelişmiş.
- Sağ kolon: Dil durumu, taslak/yayın işlemleri, slug/route özeti, öne çıkan görsel özeti.
- Blog adlandırması: sidebar ve sayfa başlığı “Blog” veya “Blog Yazıları”; teknik route `/manage/posts` ve `contentType="post"` bu spec'te değişmez.
- Home editöründe görünür etiket “Hero Section”; teknik registry key `hero` kalır.
- Ekran genişliği uygun olduğunda kısa ilişkili alanlar iki/üç kolon; uzun metin, Tiptap ve medya galerisi tam genişlik.

Bu spec alanları veya payload'ı değiştirmez. Yalnız mevcut kontroller yeniden yerleştirilir.

## 9. Dosya Sahipliği

### Ana sahiplik

- `app/manage/admin.css`
- `components/admin/EditorPageLayout.tsx` (yeni)
- `components/admin/EditorSection.tsx` veya mevcut `SectionCard.tsx` için temiz cutover
- `components/admin/FieldGrid.tsx` (yeni)
- `components/admin/SettingsCategoryNav.tsx` (yeni)
- `components/admin/AdminSidebar.tsx`
- `lib/admin/nav-items.ts` veya mevcut navigasyon kaynağı
- `app/manage/(panel)/site-settings/**`
- `app/manage/(panel)/site-content/**`
- Mevcut koleksiyon `*EditorPanel.tsx` dosyaları yalnız yerleşim amaçlı

### Dokunulmayacak sınırlar

- `prisma/schema.prisma`, `prisma/migrations/**`
- `lib/content-model/publishing.ts`
- Public page/component görsel düzeni
- SEO payload doğrulaması
- Auth/session modeli

## 10. Uygulama Sırası

1. Mevcut `SectionCard` ve form class kullanımını envanterle; ikinci accordion sistemi bırakma.
2. `EditorPageLayout`, `EditorSection`, `FieldGrid`, `SettingsCategoryNav` kontratlarını uygula.
3. Site Ayarları ekranını kategori + aktif panel düzenine taşı.
4. Site İçeriği için field registry ve tipli formu uygula; bilinmeyen key korumasını doğrula.
5. Koleksiyon editörlerini ortak layout'a geçir; alan/payload değiştirme.
6. “Gönderiler” ve “Kahraman Section” görünür metinlerini düzelt.
7. Masaüstü ve mobil gerçek tarayıcı akışını doğrula.
8. Kod/type/lint/build kontrolleri ve bağlam güncellemeleri.

## 11. Kabul Kriterleri

1. **AC-7.1** 1440px genişlikte Site Ayarları kategori listesi + aktif form olarak iki kolon görünür; 390px'te tek kolona iner ve yatay overflow yoktur.
2. **AC-7.2** Site Ayarları kategorileri §6'daki sekiz grubu içerir; bir alan yalnız tek kategoride düzenlenir.
3. **AC-7.3** `/manage/site-content` içinde ham JSON textarea veya düzenlenebilir JSON metni yoktur; tüm bilinen alanlar etiketli kontrollerdir.
4. **AC-7.4** Registry dışı bir dictionary key'i düzenlenmiş form kaydedildiğinde silinmez/değişmez.
5. **AC-7.5** Accordion başlıkları klavye ile açılır; kapalı bölümde doğrulama hatası oluşursa ilgili bölüm açılır ve hata özeti alanı işaret eder.
6. **AC-7.6** Hizmet, ürün, proje, ekip, SSS ve blog editörleri geniş ekranda ana + sağ panel düzeni kullanır; mobilde alan sırası mantıksal kalır.
7. **AC-7.7** Sidebar'da “Gönderiler” görünmez; “Blog” veya “Blog Yazıları” görünür. Home editöründe “Kahraman Section” görünmez; “Hero Section” görünür.
8. **AC-7.8** Mevcut taslak kaydetme ve dil bazında yayınlama public çıktıyı önceki semantikle günceller.
9. **AC-7.9** Admin bileşenlerinde yeni ham hex renk veya ikinci spacing/radius sistemi oluşmaz.
10. **AC-7.10** `(panel)` altında yeni `loading.tsx` ve mutasyon sonrası `router.refresh()` yoktur.

## 12. Doğrulama

### Davranış

- Site Ayarları: TR Genel alanını değiştir → taslak kaydet → yayınla → header/footer üzerinde sonucu gör → test verisini geri al.
- Site İçeriği: bilinen bir etiketi değiştir → yayınla → public yüzeyde gör; fixture'a geçici bilinmeyen key ekleyip save sonrası korunduğunu doğrula.
- Blog editörü: 1440px ve 390px ekran görüntüsü; form tab sırası ve kaydetme.
- Accordion: klavye `Tab`, `Enter/Space`; kapalı bölüm hatası.

### Komutlar

- `npx tsc --noEmit`
- `npx eslint .`
- İlgili mevcut yönetim E2E testleri
- `npm run build`

Yeni kalıcı test yalnızca şu davranışlar için değerlidir: bilinmeyen sözlük key'inin korunması, URL ile kategori seçimi ve kapalı hata bölümünün açılması. Salt class veya ekran metni pinleyen test yazılmaz.

## 13. Riskler ve Koruma

- **Veri kaybı:** Tipli form yalnız bildiği alanları serialize edip diğer key'leri düşürebilir. Çözüm: mevcut payload üzerine doğrulanmış patch uygulamak.
- **İki kaynak:** Aynı alan Site İçeriği ve Site Ayarları'nda kalabilir. Çözüm: registry sahipliği tekil; duplicate kontrolü uygulama başlangıcında hata verir.
- **Dev form ağırlığı:** Tüm Tiptap örneklerini mount etmek gecikmeyi artırır. Çözüm: yalnız aktif ayar kategorisini mount et; genel performans Spec 15'te ölçülür.
- **Referans sapması:** dr-murat-admin-ui mock data katmanı üretim koduna sızabilir. Çözüm: yalnız grid, kart, kategori listesi ve SERP benzeri görsel hiyerarşi referans alınır.

## 14. Definition of Done

- On kabul kriteri sağlanmış ve gerçek tarayıcıda masaüstü/mobil doğrulanmıştır.
- Site İçeriği kullanıcıya JSON göstermeden aynı veriyi kayıpsız düzenler.
- Site Ayarları ve koleksiyon editörleri ortak primitifleri kullanır; ikinci bir form sistemi kalmaz.
- Public tasarım ve veri modeli değişmemiştir.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- `docs/context/ui-context.md` ve `docs/context/progress-tracker.md` gerçek uygulama durumuyla güncellenmiştir.
