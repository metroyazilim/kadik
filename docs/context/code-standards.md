# Code Standards

## General

- Modüller küçük ve tek amaçlı olur; bir dosya bir sorumluluk taşır.
- Kök neden düzeltilir; semptom bastıran özel durum, sessiz `catch` veya geçici sarmalayıcı eklenmez.
- Bir bileşen veya route içinde ilgisiz sorumluluklar karıştırılmaz.
- Kesintili geçiş yapılmaz: bir yapı değiştirilince tüm çağrı yerleri taşınır, eski yol/alias/yeniden dışa aktarım silinir.

## TypeScript

- `strict` zorunludur. `any` kullanılmaz; bilinmeyen veri `unknown` olarak alınır ve sınırda daraltılır.
- Dış girdi (form verisi, query param, API gövdesi) mantık çalışmadan önce Zod ile doğrulanır.
- Dışa aktarılan tipler `Readonly`/`readonly` ile korunur; çağıran tarafın mutasyonuna açık nesne dönülmez.
- Bir dışa aktarılmış sembol değiştirilmeden önce referansları taranır; sessizce kalan çağrı yeri bırakılmaz.

## Next.js

- Varsayılan sunucu bileşenidir. `"use client"` yalnızca tarayıcı etkileşimi (state, event, effect) gerçekten gerekiyorsa eklenir.
- Her yönetim ekranı kendi route segmentidir. Ekran durumu query parametresiyle taklit edilmez.
- Sunucu eylemleri (`actions.ts`) ince adaptördür: doğrula → uygulama servisini çağır → sonucu döndür → etkilenen path/tag'i geçersiz kıl.
- `export const dynamic = "force-dynamic"` yalnızca gerçekten her istekte değişen ve önbelleklenemeyen bir route için, gerekçesi yorumda yazılarak kullanılır.
- Mutasyondan sonra istemci tarafında `router.refresh()` ile tüm ağaç yeniden kurulmaz. Sunucu eylemi kendi route'unu geçersiz kılar; gerekiyorsa `redirect()` ile hedef sayfaya gidilir.
- `app/manage/**` altında `loading.tsx` kullanılmaz: Next.js 16.3.4'te bir route segmentinde `loading.tsx` bulunması, soğuk istekte hiç çözülmeyen bir Suspense sınırı oluşturuyor (yalnızca Fast Refresh sonrası düzeliyor - doğrulanmış, bkz. `docs/specs/spec-1.md` §16). Liste/düzenleme sorguları hızlı tutulup (sayfalama + alan seçimi) sayfa tam render edilir. Next'in bu sürümdeki hatası düzeltilmeden `app/manage/**`'e yeni bir `loading.tsx` eklenmez.

## Styling

- Renk, yarıçap ve tipografi yalnızca `ui-context.md` token'larından gelir. Ham hex, ham `rgb()` veya rastgele `rounded-xl` yazılmaz.
- Tekrar eden bir görsel desen üçüncü kullanımından önce `components/admin/` altında bir bileşene çıkarılır.
- Sınıf listeleri `cn()` yardımcısıyla birleştirilir; koşullu sınıf için string birleştirme yapılmaz.

## Server Actions and Routes

- Her mutasyon önce oturumu/yetkiyi çözer, sonra girdi doğrular, sonra yazar.
- Dönüş şekli tutarlıdır: `{ error?: string; success?: string }` veya tipli sonuç nesnesi.
- Hata mesajları kullanıcıya anlamlı, sisteme dair sessizdir: token, secret, SQL, Prisma şekli ve stack trace sızmaz.
- Yıkıcı işlem (silme, arşivleme) bağımlılık kontrolünden geçer ve onay ister.

## Data and Storage

- Liste sorguları sayfalanır ve yalnızca listede gösterilen alanları seçer. `include` ile revizyon payload gövdesi liste sorgusuna alınmaz.
- Prisma erişimi veri erişim modüllerinde kalır; sunum bileşenine `prisma` çağrısı dışında sorgu kurgusu taşınmaz.
- Bayt (görsel, dosya) R2'ye, metadata veritabanına yazılır. Büyük içerik veritabanında ham olarak tutulmaz.
- Revizyon satırı yazıldıktan sonra güncellenmez veya silinmez.

## Testing

- Bir test yalnızca gözlemlenebilir bir davranışı, sınırı, değişmezi veya gerçek hatayı savunuyorsa eklenir.
- Uygulama detayı (alan kopyalama, varsayılan değer, mock yankısı, kaynak metni) test edilmez.
- Testler deterministik ve izole olur; e2e testleri kendi verisini üretir ve arkasında artık bırakmaz.
- Değişen kontrat mevcut testi kırıyorsa test yeni davranışa göre güncellenir; metni sabitlemek için yeniden yazılmaz.

## File Organization

- `app/manage/<bölüm>/page.tsx` — liste sayfası
- `app/manage/<bölüm>/[id]/page.tsx` — düzenleme sayfası
- `app/manage/<bölüm>/new/page.tsx` — oluşturma sayfası (gerekliyse)
- `app/manage/<bölüm>/actions.ts` — o bölümün sunucu eylemleri
- `components/admin/` — paylaşılan yönetim UI primitifleri
- `lib/content-model/` — içerik kuralları ve yayınlama
- `lib/public-content/`, `lib/public-pages/` — public okuma ve görünüm modelleri
- `lib/media/`, `lib/i18n/`, `lib/migration/` — alan kütüphaneleri
- `tests/unit/`, `tests/integration/`, `tests/e2e/` — test seviyeleri
