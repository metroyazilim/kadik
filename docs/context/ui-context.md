# UI Context

## Theme

Yönetim paneli açık temadır; koyu tema yoktur. Görsel dil `example-starter/organization-wpfuk` yönetim panelinden birebir alınmıştır: beyaz yüzeyler, `#f7f8fa` sayfa zemini, lacivert metin, kırmızı vurgu ve keskin (maksimum 4px) köşeler. Panel "kurumsal operasyon konsolu" gibi görünür: yoğun bilgi, ince çizgiler, büyük harf küçük punto etiketler, gölge yerine kenarlık.

Public site kendi mevcut görsel dilini korur. Bu dosyanın renk tabloları yönetim paneli için bağlayıcıdır.

## Colors

Tüm token'lar `app/manage/admin.css` içinde `:root` altında tanımlanır ve Tailwind 4'e `@theme inline` ile açılır. Bileşenlerde ham hex kullanılmaz.

| Role | CSS Variable | Value |
| --- | --- | --- |
| Sayfa zemini (panel) | `--admin-bg-page` | `#f7f8fa` |
| Yüzey / kart | `--bg-base` | `#ffffff` |
| Soluk yüzey | `--bg-muted` | `#f4f5f7` |
| Ters yüzey (marka bloğu) | `--bg-invert` | `#0c1b33` |
| Ters yüzey (yumuşak) | `--bg-invert-soft` | `#152743` |
| Ana metin | `--text-primary` | `#0c1b33` |
| Soluk metin | `--text-muted` | `#5b6472` |
| Ters metin | `--text-invert` | `#ffffff` |
| Ters soluk metin | `--text-invert-muted` | `#a8b2c1` |
| Vurgu | `--accent` | `#ef2b3d` |
| Vurgu (koyu) | `--accent-dark` | `#c81e2e` |
| Kenarlık | `--border-default` | `#e4e7ec` |
| Ters kenarlık | `--border-invert` | `rgba(255,255,255,0.12)` |
| Hata | `--state-error` | `#c81e2e` |
| Başarı | `--state-success` | `#1b8a5a` |
| Uyarı / taslak | `--state-warning` | `#b45309` |

Vurgu rengi bilinçli olarak kıttır: eyebrow etiketi, birincil buton, aktif menü işareti, aktif menü ikonu, sayısal öne çıkan değer. Başka hiçbir yerde kullanılmaz.

## Typography

| Role | Font | Variable |
| --- | --- | --- |
| UI metni | Inter (system-ui fallback) | `--font-sans` |
| Kod / teknik değer | ui-monospace | `--font-mono` |

Ölçek: sayfa başlığı `text-2xl font-bold`, kart başlığı `text-sm font-bold`, tablo başlığı `text-[10px] font-bold uppercase tracking-wider`, gövde `text-sm`, yardımcı metin `text-xs text-[var(--text-muted)]`.

## Border Radius

| Context | Class |
| --- | --- |
| Buton, etiket, ikon kutusu | `rounded-[var(--radius-sm)]` (2px) |
| Kart, tablo, panel | `rounded-[var(--radius-md)]` (3px) |
| Toast, açılır yüzey | `rounded-[var(--radius-lg)]` (4px) |

Bundan daha yuvarlak bir köşe kullanılmaz.

## Component Library

Harici bir bileşen kütüphanesi kullanılmaz. Yönetim paneli primitifleri `components/admin/` altında yaşar ve wpfuk referansındaki karşılıklarıyla aynı yapıdadır:

- `AdminShell` — kenar çubuğu + üst çubuk + içerik alanı, toast sağlayıcısı
- `AdminSidebar` — bölümlenmiş navigasyon (`usePathname` ile aktif durum), kullanıcı kartı, çıkış
- `AdminTopbar` — mobil menü düğmesi, bölüm etiketi, "Siteyi görüntüle" bağlantısı
- `PageHeader` — sayfa başlığı, açıklama, birincil eylem bağlantısı
- `StatCard` — sayısal özet kartı
- `SectionCard` — açılır/kapanır form bölümü
- `DataTable` başlık/satır desenleri — tablo iskeleti kart içinde
- `StatusPill` / `LocaleStatusBadge` — yayın/taslak/eksik durumu
- `Toast` + `ToastForm` — sunucu eylemi sonucunu bildiren geçici mesaj
- `DeleteButton` — onay isteyen yıkıcı eylem düğmesi
- `AuthLayout` — giriş ekranı için iki panelli düzen
- `RichTextEditor`, `MediaField`, `MediaPickerModal`, `SortableList` — mevcut alan bileşenleri, yeni token setine uyarlanır

## Layout Patterns

- **Kabuk**: sol tarafta 256px (`w-64`) sabit kenar çubuğu, `lg` altında çeviri (translate) ile açılan çekmece; içerik alanı `lg:ml-64`
- **Üst çubuk**: `sticky top-0`, yarı saydam beyaz, alt kenarlıklı
- **Sayfa gövdesi**: `mx-auto max-w-6xl`, `px-4 py-6 lg:px-8 lg:py-7`
- **Liste sayfası**: `PageHeader` → özet kartları ızgarası → kart içinde tablo → sayfalama satırı
- **Düzenleme sayfası**: `PageHeader` (geri bağlantısıyla) → dil sekmeleri → form bölümleri → sağ altta sabit olmayan, formun sonunda yer alan kaydet/yayınla eylem çubuğu
- **Boş durum**: kesikli kenarlıklı kart, ikon, açıklama, birincil eylem
- **Toast**: sağ altta, 3.8 saniye sonra kaybolur

### Editor layouts

- Geniş ekran düzenleyicisi `minmax(0, 1fr) + 320–360px aside`; mobilde tek kolon.
- Ayar merkezi masaüstünde kategori listesi + aktif form, mobilde tek kolon/select.
- Tek accordion primitive'i semantik `details/summary` veya eşdeğer erişilebilir kontrat kullanır; ikinci kart sistemi oluşturulmaz.
- İlişkili kısa alanlar iki/üç kolon `FieldGrid`; Tiptap, medya galerisi ve uzun metin tam genişlik.
- Anasayfa editörü sabit bölüm listesidir: sürükleme, ekleme ve silme yoktur. Her kart dil sekmeleri, bölüme özgü alanlar (metin, medya, ikon, buton, bağlantı) ve tek "Kaydet ve yayınla" eylemi taşır.
- SEO ekranı sol route listesi + sağ SERP/social preview ve form hiyerarşisidir.
- Audit iç yüzeyi terminal görünümü kullanabilir fakat mevcut invert tokenlardan türetilir; sahte shell/command input yoktur.
- Tablo feedback'i normal akışa satır/kart eklemez; toast + ilgili row state kullanır.
- Görünür terminoloji “Blog / Blog Yazıları” ve “Hero Section”dır; teknik `/manage/posts` ve `hero` key'i korunabilir.
- Reference ekranlar layout/hiyerarşi kaynağıdır; mock data, farklı token seti veya geniş yuvarlak kart stili kopyalanmaz.

## Icons

lucide-react. Yalnızca çizgi (stroke) ikonlar. Boyutlar: satır içi `size-4`, düğme `size-4`, boş durum `size-8`, marka `size-8`. Aktif menü ikonu `text-[var(--accent)]`, pasif `text-zinc-400`.
