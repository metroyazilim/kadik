# Progress Tracker

## KADİK güncel kayıt — 2026-09-18

- KADİK public sitesi tek yapısal dile indirildi: `/tr/*` route ağacı tamamen kaldırıldı (bir önceki turda `app/tr/**` ve `KadikLayoutTr.tsx` silinmişti; bu turda `lib/kadik-i18n.ts`'deki `KadikLocale` tipi `"en"` tekil değerine indirgendi, `KADIK_PATHS`'ten `tr` girdileri ve ~260 satırlık Türkçe `tr` sözlüğü kaldırıldı, `components/KadikLayout.tsx` her zaman `lang="en"` render eder). `next.config.ts`'deki eski Türkçe slug yönlendirmeleri (`/hakkimizda`, `/galeri`, `/gonulluluk` vb.) artık `/tr/...` yerine doğrudan İngilizce kanonik adrese (`/about`, `/gallery`, `/membership`...) 308 döner. `app/api/kadik-api` ve `app/api/kadik/contact` route'larındaki gömülü `locale: "tr"` değerleri `"en"` oldu.
- Google Translate widget (`components/GoogleTranslateWidget.tsx`) diğer dilleri (TR dahil) istemci tarafı makine çevirisiyle karşılıyor; bu, kaldırılan `/tr` route'unun yerine geçen kalıcı mekanizma. Google'ın kendi üstteki "Şu dile çevrildi" banner'ı kendi cross-origin stylesheet'iyle her `!important` CSS kuralını eziyor ve inline `style`'ı da birkaç yüz ms içinde kendiliğinden sıfırlıyor; tek çalışan çözüm 200ms'lik bir `setInterval` ile `body > div.skiptranslate` düğümüne sürekli `display:none !important` uygulamak oldu (tek seferlik `MutationObserver` denemesi Google'ın reset'ini yakalayamadı, doğrulanmış).
- Apex/staging ayrımı (`proxy.ts`) zaten mevcuttu: `COMING_SOON_HOSTS` env değişkenindeki host'lar (varsayılan `kadiklondon.org,www.kadiklondon.org`) her path'i `/coming-soon`'a (İngilizce, header/footer'sız, bağımsız `<html>` kökü) rewrite ediyor; `staging.kadiklondon.org` ve her başka host gerçek siteyi görüyor. Değişken `.env.example`'a dokümante edildi; hangi domainde hangi yüzeyin çıkacağı sadece bu env değeriyle ayarlanır.
- `tests/kadik/site.spec.ts` yeniden yazıldı: TR/EN dual-locale iterasyonu, `.kadik-lang-switch` ve dil değiştirici testi kaldırıldı; galeri/takvim/form testleri tek İngilizce route'a taşındı; legacy redirect testi İngilizce hedefleri doğruluyor; yeni bir test `/tr/*`'nin 404'e düştüğünü (Türkçe içerik sızmadığını) doğruluyor. `errorsOn()` Google'ın kendi bot rate-limit CAPTCHA yönlendirmesini (`google.com/sorry/...`, bizim CSP'imizce bloklanıyor) gürültü olarak filtreliyor - dış servis kaynaklı, uygulama hatası değil.
- Doğrulama: `npx tsc --noEmit`, `npx eslint .` (0 hata), `npm run build`, `playwright test --config=playwright.kadik.config.ts` desktop+mobile (42/42 yeşil) `/Users/berat/anton/kadik` üzerinde, port 3901.
- Kasıtlı dokunulmayan: `app/[locale]/**`, `app/en/**`, `app/servisler|urunler|projeler|ekip|blog|sss|partnerler|misyon-ve-vizyon|arama` - bunlar `architecture.md`'de tanımlı ayrı, kalıcı CMS mimarisi (`ContentLocale` `tr`+`en`, TR öneksiz/EN `/en` önekli); KADİK public sitesinin `/tr` deneyiyle ilgisizdir, kapsam dışı bırakıldı.
- Dokploy dağıtımı: `entrypoint.sh`'nin Postgres bekleme döngüsü `psql: error: invalid integer value "..." for connection option "port"` ile başarısız oluyordu - kök neden, `docker-compose.yml`'in `POSTGRES_PASSWORD`'ü hiç URL-encode etmeden `DATABASE_URL: postgresql://...@db:5432/...` içine ham interpolasyonla basması; parolada `/` geçtiğinde libpq URI parser'ı bozuluyor. Çözüm: compose artık `DATABASE_URL` üretmiyor, `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`/`DATABASE_HOST`/`DATABASE_PORT`'u ham geçiyor; `entrypoint.sh` bunlardan `encodeURIComponent` ile (mevcut Node çalışma zamanı üzerinden) doğru şekilde encode edilmiş `DATABASE_URL`'i kendisi kuruyor. Doğrudan `DATABASE_URL` verilen (yönetilen/harici Postgres) kurulumlar değişmeden çalışmaya devam eder. Yerelde `psql` ile URI parse doğrulandı; mevcut secret'lar (parola değiştirmeden) artık doğru bağlanır.
- Yeni statik sayfa: **Charter** (`/charter`, footer'da Privacy/Terms yanında). `lib/kadik-i18n.ts`'e `charter` page key + path + `legal.charterTitle/charterLead/charterSections` (26 madde, kullanıcının verdiği Türkçe tüzük metninin tam İngilizce çevirisi) eklendi; `KadikLegal` bileşeni `charter` prop'uyla üçüncü bir varyant oldu (`components/KadikSite.tsx`), route `app/charter/{page,layout}.tsx`. `sitemap.ts` `KADIK_PATHS` üzerinden otomatik kapsıyor, ayrı kod değişikliği gerekmedi.
- Dokploy prod deploy sorunları çözüldü (kod dışı, altyapı): (1) her iki stack'in (production `kadik-nhruwq`, staging `kadik-staging-cgfch6`) Postgres volume'ları eski/yanlış şifreyle önceden init olmuştu - volume silinip temiz redeploy ile düzeltildi. (2) Dokploy Domain ayarlarında Traefik hedef portu yanlış girilmişti (host-mapped port 3001/3002 yerine container'ın iç portu 3000 olmalı) - ikisi de 3000'e düzeltildi. (3) staging'in Cloudflare DNS kaydı Proxied'ti, Let's Encrypt ACME challenge'ını engelliyordu - DNS only'e çevrildi. Üçü de kod değil Dokploy/Cloudflare panel ayarı; ileride yeni bir domain eklenirken aynı üç noktaya dikkat edilmeli.
- Kurul üyesi fotoğrafları hâlâ placeholder: `.local/seed-images` (script varsayılanı) ve gerçek fotoğraflar içeren `.local/kurul-fotograflari` ikisi de gitignore'lu, Docker image'ına girmiyor; container içi seed bu yüzden placeholder yayınlıyor. Gerçek fotoğraflar `/manage/team` üzerinden elle yüklenerek değiştirilebilir; kalıcı çözüm (image'a gömme ya da deploy sonrası otomatik `--photos` adımı) yapılmadı.

## KADİK güncel kayıt — 2026-09-17 (ikinci tur)

- Cloudflare R2 canlı: gerçek anahtarlar `.env.local`'e işlendi, `getStorageConfig()` artık `R2_PUBLIC_BASE_URL`/`MEDIA_BASE_URL` de okuyor (şablon bu adları kullanıyordu, kod okumuyordu). Yükleme hattı `scripts/media-import.ts` (`npm run media:import`): kaynak yerel dosya veya URL → `cwebp -q 85` → `validateUploadBuffer` → `createMediaAsset`; `--dir` modu klasördeki tüm görselleri sırayla yükler, checksum idempotency ikinci çalıştırmada yeni obje/satır üretmez.
- İçerik veritabanından geliyor: `scripts/seed-kadik-content.ts` (`npm run db:seed-kadik`) 6 kurul üyesini (başkan, başkan yardımcısı, 4 üye) ve 2 yayını panelin kendi akışıyla (`createCollectionEntity` → `ensureLocaleTranslation` → `adminSaveDraft` → `adminPublish`) yazıp yayımlar; görseller R2'de WebP olarak durur. Ana sayfa ve `/yazilar` artık yayınlanmış revizyonları okur (`lib/public-content/kadik-view.ts`), yazı detayı `/yazilar/<slug>` olarak eklendi ve eski iki statik yazı route'u kaldırıldı.
- Üyelik akışı başvuruya dönüştü: `/gonulluluk` → `/uyelik` (308, `next.config.ts`), kampanya dönemi "nasıl katkı sunabilirsiniz" dropdown'ı kaldırıldı; form ad/e-posta/telefon/şirket/görev/sektör/şehir/web/referans + başvuru notu topluyor, konu satırı `Üyelik başvurusu: <şirket>` olarak `Message` kaydına düşüyor.
- Global 404 site kabuğunu kullanıyor (`KadikNotFound`): banner + 404 bloğu + altı bölüm bağlantısı. Kök `app/layout.tsx` olmadığı için `not-found.tsx` `globals.css`'i doğrudan import eder; `KadikLayout` sarmalaması ikinci `<html>` üretip hydration uyuşmazlığına yol açıyordu.
- Görsel dil politik çağrışımdan arındırıldı: hero/banner/hakkımızda/galeri görselleri iş dünyası fotoğraflarıyla (standart Unsplash lisansı, WebP q85) değiştirildi; etkinlik takvimi ve galeri kategorileri iş gündemine göre yazıldı.
- Yönetim paneli IA'sı public siteye hizalandı: sidebar bölümleri (Genel / Site İçeriği / KADİK İçerikleri / Diğer Koleksiyonlar / SEO ve Sistem), her ekranda `publicHref` ile "Sitede gör" bağlantısı ve Genel Bakış'ta KADİK sayfa kısayolları. Nav key/href kümesi değişmedi.
- Gerçek kurul fotoğrafları yüklendi (geçici temsili portreler kaldırıldı): 6 fotoğraf ekran görüntüsü artıklarından arındırıldı (Yaşar Karadağ'da letterbox siyah bantlar, Orhan Selim Bayraktar'da tarayıcı çubuğu + alt navigasyon `ffmpeg crop` ile kesildi), 900px genişliğe indirildi, `cwebp -q 85` ile WebP'e çevrilip `scripts/seed-kadik-content.ts --photos <klasör>` moduyla R2'ye yüklendi ve üyeler aynı slug ile yeniden yayımlandı. Kaynak klasör: `.local/kurul-fotograflari` (gitignore). Yerini alan 6 geçici asset + 2 R2 smoke asset'i arşivlendi (kalıcı silme yapılmadı).
- Kurul kartlarında "Profili incele" bağlantısı kullanıcı talebiyle kaldırıldı: kartlar artık `<article>` (tıklanabilir değil), hover kalkma efekti ve ölü `.kadik-board-card b` stili silindi, portreler `object-position: center top` ile yüzler görünecek şekilde çerçevelendi. `/ekip/<slug>` route'ları duruyor, public menüden bağlantı verilmiyor.
- Doğrulama: `npm run dev` (3901) üzerinde Chrome ile ana sayfa, `/kurul-uyeleri`, `/uyelik` (gerçek başvuru gönderimi), `/yazilar`, yazı detayı, 404 ve panel ekranları gezildi; kırık görsel yok, `data-motion-state="pending"` kalmadı, R2 URL'leri 200 + `image/webp`.

## KADIK güncel kayıt — 2026-09-17

Kanonik checkout `/Users/berat/anton/kadik`; port 3901. Kalan alt bölümler kopyalanmış starter geçmişidir ve KADIK için tamamlanma iddiası değildir.

- DB kesintisi kök nedeni: standalone PostgreSQL kapanmış; dev komutu tekrar açmıyordu. Otomatik readiness/startup ve yerel toparlama eklendi.
- 404 veri sorguları kaldırıldı; 6 yeni root layout eklendi; admin login servis kesintisini anlaşılır gösterir.
- Public scroll motion, reduced-motion, galeri/filtre/takvim ve form reset/idempotency düzeltildi.
- Navbar bilgi mimarisi güncellendi: `Hizmetler` dropdown'ında Etkinlikler, Gönüllülük ve Duyurular; ayrı `Katıl` butonu kaldırıldı.
- Tekrarlanabilir doğrulama: `playwright.kadik.config.ts`, `tests/kadik/site.spec.ts`, `scripts/verify-local-recovery.mjs`.
- Güncel ayrıntı ve kanıt: `kadik-verification.md`; başlatma: `local-development.md`.

Bu dosya disk gerçeğini ve sıradaki spec güdümlü çalışma birimlerini izler.

Son güncelleme: 2026-09-11 — Yeni statik sayfa: Partnerler (`/partnerler`, `/en/partners`), Portföy menüsünün son alt öğesi. Anasayfanın "Marka Güveni" (`brandTrust`) bölümüyle aynı yayınlanmış `logoItems`'ı `loadPublicHomeView` üzerinden okuyup `BrandTrustPart`/`Marquee` ile render eder - ayrı bir içerik modeli veya admin ekranı eklenmedi, tek kaynak `/manage/home` kalır. Sayfa metinleri (`partnersPage.banner/subtitle/title/intro/empty`, `meta.partners`) `lib/i18n/dictionaries/{tr,en}.ts` + `lib/page-copy-registry.ts`'e (`/manage/pages/copy/partners`) eklendi, TR segmenti `partnerler` / EN segmenti `partners` `lib/i18n/static-pages.ts`'e işlendi (otomatik `/tr/partners` kalıcı yönlendirmesi dahil). Nav'daki "Portföy" alt menüsü hem kod içi `tr.ts`/`en.ts` hem de **yayınlanmış** `SiteContentTr`/`SiteContentEn.dictionary` DB satırındaki `nav` dizisine (admin panelinden özelleştirilmiş, `mergeDictionary` array'i bütün olarak override ediyor) elle eklendi - yalnızca dosya değişikliği canlı nav'a yansımaz. Her yeni üst-seviye statik TR route'u (`app/<segment>/page.tsx`) kendi `layout.tsx`'ini taşımak zorunda (`app/layout.tsx` yok, `<html>` kök `[locale]/layout.tsx`'ten `LocaleLayout` ile gelir) - unutulursa "Missing <html> and <body> tags" runtime hatası verir; `app/partnerler/layout.tsx` diğer statik sayfalarla birebir aynı desende eklendi. `tsc`/`eslint` temiz, TR ve EN sayfalar `localhost:3900`'de tarayıcıda ve `curl` ile doğrulandı (200, logolar HTML'de, nav linki her iki dilde de gerçek href üretiyor).

Aynı tur, ikinci düzeltme — Partnerler sayfasında logo şeridi kayan `Marquee` yerine statik responsive grid (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4`, her logo `border-hairline` kartında) oldu; Portföy alt menüsünde "Partnerler" sırası "Projelerimiz"in üstüne alındı (Misyon & Vizyon → Partnerler → Projelerimiz → SSS), hem kod sözlüklerinde hem yayınlanmış `SiteContentTr/En.dictionary` DB satırında.

2026-09-10 — Dokploy dağıtımı çalışır durumda (build DB gerektirmiyor, entrypoint psql URL ayıklama + ilk admin bootstrap) ve mobil menü çekmecesi yayınlanmış markayı render ediyor. Önceki tur:  Sayfa yapısı koda sabitlendi: anasayfada bölüm ekleme/silme/sıralama kaldırıldı, 11 sabit bölümün metin/görsel/ikon/buton/bağlantı alanları `/manage/home` akordiyonunda düzenlenir. Koleksiyon bölümlerine grid kolon sayısı, kayıt adedi ve `en yeniler / elle seç / kategori` seçimi eklendi. Tüm public sayfaların sabit metinleri `/manage/pages/copy/<pageKey>` üzerinden dil bazında düzenlenir.

2026-09-09 (ikinci tur) — example-starter.com Türkçe içeriği (görseller hariç) siteye aktarıldı: 6 hizmet, 2 iş/proje, 2 ekip üyesi, 4 blog yazısı yayınlandı; 11 sabit anasayfa bölümünün TR alanları, Hakkımızda payload'ı, site ayarları iletişim bilgileri ve TR dictionary sayfa metinleri güncellendi. Eski demo/seed ve e2e artığı kayıtlar arşivlendi. EN/RU/AR aktarımı sonraki turda yapılacak.

2026-09-09 (üçüncü tur) — Marka adı "Extech" depodan kaldırıldı (paket adı `corporate-starter`, veritabanları `metro_yazilim`/`metro_yazilim_test`). Hero'da üst başlık kaldırıldı, ana başlık büyütüldü (`clamp(48px,6vw,76px)`), ana başlık ve açıklama tek Tiptap zengin metin alanı oldu. Anasayfa bölümleri `/manage/home` içinde dnd-kit ile sürüklenip sıralanıyor; sıra `HomeLayout` revizyonuna yazılıp yayınlanıyor ve public projeksiyon artık sabit sıra yerine yayınlanmış layout'u okuyor. Dictionary fallback'i kaldırıldı: boş bırakılan alan public tarafta hiç render edilmez (`home-fixed-defaults.ts` silindi, part'lardaki sabit yer tutucu metinler temizlendi). Medya yüklemeleri tarayıcıda WebP %85'e dönüştürülüyor. Şifremi unuttum + şifre sıfırlama akışı (SMTP, tek kullanımlık hash'li token, `PasswordResetToken` tablosu) ve tüm şifre alanlarında göz/göz-çizgili görünürlük anahtarı eklendi. R2 ve SMTP staging değerleri `.env`'e yazıldı.

2026-09-09 (dördüncü tur) — example-starter.com importundan gelmeyen tüm koleksiyon kayıtları kalıcı silindi (197 kayıt: 63 SSS, 10 ürün, 53 arşiv hizmet, 63 arşiv ekip, 4 arşiv proje, 4 arşiv blog). Geriye yalnız import edilen 6 hizmet, 2 proje, 2 ekip üyesi ve 4 blog yazısı kaldı; ürün ve SSS koleksiyonları artık boş. Silme öncesi yedek: `/tmp/metro_yazilim_before_cleanup.sql`. Ayrıca marka şeridi logo başına renkli kare kutu + akışkan 240x80 boyut aldı, medya seçicideki alt metin/açıklama artık `MediaAsset` üzerine kalıcı yazılıyor.

2026-09-09 (beşinci tur) — Spec 10'un eksik editör yüzeyi eklendi: koleksiyon editörlerinde dil sekmelerinin sağında "Yapay zekâ ile çevir" düğmesi; TR payload'dan hazır prompt üretilir, dönen `{"translations":{en,ru,ar}}` JSON'u yapıştırılıp `importTranslationsAtomically` ile yalnız taslak olarak yazılır (slug her dilde başlıktan yeniden türetilir). Sluglar tüm koleksiyonlarda başlıktan otomatik üretilir, elle slug alanı kaldırıldı. Silme yetkisi rol tabanlı: ADMIN/SUPER_ADMIN her koleksiyonu, AUTHOR hizmet/SSS/proje/ürün/blog siler; yayındaki kayıt da silinebilir (route ve çeviriler cascade). Liste ekranları artık silme/arşivleme hatasını dialogda gösteriyor (önceden sessizce yutuluyordu). Ekip kaydında sosyal bağlantılar Instagram+LinkedIn'e indirildi, yetkinlik/eğitim alanları tamamen kaldırıldı ve eski payload'lar migrate edildi.

2026-09-09 (altıncı tur) — Çeviri asistanı sayfalara ve site ayarlarına da yayıldı: Hakkımızda ve Site Ayarları entity tabanlı olarak, `/manage/pages/copy/<pageKey>` ise sözlük tabanlı `source`/`onApply` moduyla aynı bileşeni kullanır. Prompt artık `json` kod bloğu ister ve markdown link üretimini yasaklar; gelen metin `repairAiJsonText` ile onarılır (ChatGPT'nin e-posta/URL'leri linkleyip JSON'u bozması giderildi). RU çıktısı Kiril, AR çıktısı Arap alfabesi ve unvanlar çevrilir. Tüm editörlerde tek düzen: kırmızı "Kaydet ve yayınla" (tek adımda kaydeder + yayınlar), gri "Kaydet"; Ctrl/⌘+S kaydeder. Yönetim panelinde "taslak" kelimesi tamamen kaldırıldı (durum etiketi "Kaydedildi"). TR dışı diller TR slug'ını kullanır: Kiril/Arap başlıktan boş slug üretilip kaydın kaydedilememesi hatası düzeltildi.

2026-09-09 (yedinci tur) — Anasayfa çevirisi bölüm bölüm değil toplu: tek prompt 11 bölümün TR payload'ını kapsar, yapıştırılan JSON `importHomeTranslationsAction` ile tüm bölümlere yazılır. Tüm çeviri içe aktarmaları (koleksiyonlar, Hakkımızda, site ayarları, anasayfa) artık kaydedip **otomatik yayınlar**; koleksiyonlar TR slug'ıyla locale route'unu da oluşturur. Anasayfada her bölüm satırında göz/göz-çizgili görünürlük anahtarı var (`HomeLayout.enabled` + layout publish; gizlenen bölüm public sayfadan anında düşer) ve kayan yazı bölümüne kelime ekleme/kaldırma geldi. Anasayfa bölümlerinde ayrıca gri "Kaydet" (yayınlamadan) düğmesi eklendi; Ctrl/⌘+S yalnız kaydeder.

2026-09-09 (sekizinci tur) - Yönetici kullanıcı yönetimi ve iletişim bildirim maili eklendi. `/manage/users` artık salt liste değil: SUPER_ADMIN kullanıcı ekleyebiliyor, rol değiştirebiliyor, şifre sıfırlayabiliyor ve hesap silebiliyor (`app/manage/(panel)/users/actions.ts` + `UsersManager.tsx`). Yetki her işlemde veritabanındaki rolden okunuyor; son SUPER_ADMIN'in rolü düşürülemiyor ve silinemiyor, kişi kendi hesabını silemiyor. Rol/şifre değişimi `tokenVersion`'ı artırarak açık oturumları kapatıyor; her işlem `AuditLog`'a yazılıyor. İletişim formu kaydı sonrası `lib/contact-notification.ts` üzerinden SMTP bildirimi gönderiliyor (gönderim hatası ziyaretçiye hata olarak yansımıyor). Gerçek SUPER_ADMIN hesabı oluşturuldu: `arslan@example-starter.com`.

2026-09-09 (dokuzuncu tur) — Dil kapsamı Türkçe + Global (İngilizce) olarak daraltıldı. Rusça/Arapça kanonik i18n olmaktan çıkarıldı: `ContentLocale` enum'u `tr|en` oldu (`prisma/migrations/20260909170000_reduce_locales_to_tr_en`, canlı DB'de 82 `ContentTranslation`, 30 `ContentRoute`, 39 `LegacyMigrationMap`, 73 outbox ve 2 `MediaUsage` satırı ile `SiteContentRu`/`SiteContentAr` tabloları kaldırıldı; yedek `/tmp/metro_yazilim_before_tr_en_cutover.dump`). `app/ru/**`, `app/ar/**`, `lib/i18n/dictionaries/{ru,ar}.ts`, Kiril/Arap fontları ve `html[lang=ru|ar]` CSS blokları silindi; tüm segment haritaları, revalidate listeleri, admin dil sekmeleri ve çeviri asistanı yalnız `en` üretir (`{"translations":{"en":{…}}}`), `importTranslationsAtomically` başka locale'i reddeder. Dil seçici iki seçenek gösterir: "Türkçe" (öneksiz) ve "Global" (`/en`, kod rozetinde `GL`, standart tarafta hâlâ `en`). Diğer diller uygulama i18n'i değil, tarayıcı/Google çevirisidir. Ayrıca eksik `AdminUser.role`/`avatarAssetId` migration'ı eklenip canlı DB'de applied olarak işaretlendi ve `scripts/tmp-*.ts` tek seferlik betikleri silindi. Doğrulama: `npx tsc --noEmit`, `npx eslint .` (0 hata), 483 unit+integration testi, `npm run build`, tarayıcıda `/`, `/en`, `/servisler`, `/en/services`, `/sss`, `/en/faq`, `/ekip/<slug>`, `/en/team/<slug>` 200 ve `/ru*`, `/ar*` 404; `/hakkimizda` hreflang yalnız tr/en/x-default.

2026-09-09 (onuncu tur) — İçerik, sosyal bağlantılar ve dağıtım altyapısı. Site ayarları TR+EN yeniden yayınlandı: iletişim `info@example-starter.com` / `+61 404 336 767`, Global adres alanı dolduruldu, e2e artığı `terms-e2e-…` metni yerine gerçek Kullanım Şartları ve KVKK/GDPR uyumlu Gizlilik Politikası (TR ve EN, 8 bölüm) yazıldı. Menüdeki "Sayfalar/Pages" başlığı "Portföy/Portfolio" oldu (hem sözlük dosyaları hem `SiteContent{Tr,En}.dictionary` kaydı). `lib/contact.ts` fallback'leri gerçek değerlere çekildi; `lib/social.ts` tek kayıt olarak YouTube/LinkedIn/X hesaplarını tutuyor, üst şerit ve footer aynı listeyi okuyor (hesabı olmayan Facebook kaldırıldı). Ekip kartı yeniden yazıldı: yalnız dolu sosyal bağlantılar görünür, kartın tamamı overlay anchor ile detay sayfasına gider (iç içe anchor yok), anasayfa kartları da `generateRoute` ile öneksiz Türkçe adrese bağlanır. `IntroOverlay` (no-op) kaldırılıp yerine `components/ScrollToTop.tsx` geldi: `history.scrollRestoration = "manual"` + ilk boyamada başa dön (hash varsa dokunmaz). Dağıtım: `Dockerfile` (Next standalone, node:22-alpine, non-root, psql dahil), `docker-compose.yml` (postgres:17 + app, healthcheck, tüm secret'lar env'den), `docker/entrypoint.sh` (DB bekle → `prisma migrate deploy` → veritabanı boşsa `generic demo seed` import → `node server.js`), `.dockerignore`, `next.config.ts` `output: "standalone"`. Eksik `prisma/seed.ts` yazıldı (idempotent SUPER_ADMIN + registry bootstrap). İki migration sürüklenmesi kapatıldı: `20260909190000_content_page_key_values` ve `20260909200000_restore_legacy_layout_tables` (yalnız eklemeli; eski dil tabloları silinmez), canlı DB'de applied işaretlendi. `generic demo seed` = yönetici/denetim/mesaj verisi hariç `pg_dump` anlık görüntüsü; temiz bir veritabanında `migrate deploy` + import ile 41 entity / 82 çeviri doğrulandı. Doğrulama: `npx tsc --noEmit`, `npx eslint .` (0 hata), 483 test, `npm run build`, `docker compose config`, tarayıcıda menü/telefon/e-posta/hukuki sayfalar ve yenilemede başa dönüş.

2026-09-10 (on birinci tur) — Dokploy/Docker dağıtımı gerçekten çalışır hale getirildi ve mobil menüdeki eski marka kalıntısı temizlendi. (1) `next build` artık veritabanı olmadan geçiyor: `getPublicSiteSettings`/`getPublicLegalDocument` bağlantı hatasını `getPublicDictionary` ile aynı sözleşmeyle yutup `null` dönüyor (önceden `getSiteSettingsEntityId` build sırasında fırlatıp `/_not-found` prerender'ını çökertiyordu), `app/manage/(panel)/layout.tsx` ise `export const dynamic = "force-dynamic"` ile oturum kapılı panelin prerender edilmesini tamamen kapatıyor (`/manage/home` içindeki `ensureHomeSectionRegistry` ile cookie bailout yarışı build'i rastgele düşürüyordu). (2) `docker/entrypoint.sh` Prisma'ya özel query parametrelerini (`schema`, `connection_limit`, `pool_timeout`, `pgbouncer`, …) psql'e vermeden ayıklıyor — libpq `invalid URI query parameter: "schema"` ile reddettiği için DB bekleme döngüsü ve snapshot importu hiç çalışmıyordu; `sslmode`/`sslrootcert` gibi gerçek libpq parametreleri korunuyor. (3) Boş veritabanında entrypoint artık generic demo seed importundan sonra `prisma/seed.ts`'i de çalıştırıyor: ilk `SUPER_ADMIN` `ADMIN_EMAIL`/`ADMIN_PASSWORD`'dan oluşuyor (snapshot içerik taşır, kimlik bilgisi taşımaz), registry satırları idempotent no-op kalıyor; dolu veritabanında bootstrap tamamen atlanıyor, admin şifresi yeniden yayınlarda sıfırlanmıyor. Runner imajı bunun için tam `node_modules` + `lib/` + `package.json`/`tsconfig.json` taşıyor. (4) Mobil menü çekmecesi sabit `Ex<span>tech</span>` yazı markasını değil header'ın okuduğu yayınlanmış logo/marka adını render ediyor (`MobileMenu` yeni `brand` prop'u, `SiteHeader` besliyor). Doğrulama: `npx tsc --noEmit`, `npx eslint`, art arda üç temiz `next build` (erişilemez DB, 0 hata) ve `docker compose … up -d --build` ile gerçek yığın: 18 migration uygulandı, snapshot 41 `ContentEntity`/30 route/14 medya olarak içe alındı, `seed: created SUPER_ADMIN` loglandı, 13 public route 200 döndü, Playwright ile login → `/manage` → `/manage/home` → `/manage/site-settings` oturumu korudu, mobil çekmece ekran görüntüsüyle Corporate Starter logosu doğrulandı. Not: `generic demo seed` içindeki 259 orphan revizyonda hâlâ e2e artığı "Extech fallback-…" metni var; yayınlanmış/taslak hiçbir revizyonda yok, bu yüzden public tarafa sızmıyor.

## Current Goal

Yönetim panelini mevcut Metro CSS/tasarım dili içinde modern içerik mimarisine geçirmek: responsive editörler, reusable section/page builder, çoklu dil aktarımı, merkezi SEO, gerçek RBAC/profil/yazarlık, audit terminali, güvenli kalıcı silme, ölçülmüş hızlı navigasyon ve example-starter.com kaynak içerik importu.

## Disk Gerçeği

- Kanonik repo: `/Users/berat/extech`, branch `main`.
- Spec yazım SHA'sı: `bdccb66`.
- Çalışma ağacı kirli; kullanıcı çalışması korunur, uygulayan model ilgisiz değişiklikleri geri almaz.
- `AdminUser.name` var; `AdminRole`, `/manage/users`, profil avatarı ve server permission matrisi yok.
- Post editörü serbest metin `author` alanı kullanıyor.
- `/manage/pages` her public sayfayı listeler; sabit metin düzenleyicisi `/manage/pages/copy/<pageKey>`, Hakkımızda ek olarak kendi payload editörünü taşır.
- Anasayfa 11 sabit bölümdür; ekleme/silme/sıralama yoktur. Alanlar `home-section:<key>` revision payload'ında saklanır, boş alanlar dictionary varsayılanına düşer.
- `/manage/site-content` ve dinamik page-builder canvas kaldırıldı. Anasayfa alanları Home akordiyonunda; global/yasal ayarlar `/manage/site-settings` içinde kalır.
- `/manage/seo` audit/bulgu ekranı; route bazlı SERP editor değil.
- Audit sonlu liste; yukarı scroll cursor geçmişi yok.
- Collection archive/hard-delete görsel ve permission kontratı tutarlı değil.
- Kullanıcının client-side navigation yavaşlığı gözlemi doğrulanacak bir performans gereksinimidir; semptom animasyonla gizlenmez.

## Tamamlanmış Eski Birimler

- **Spec 1 — Yönetim paneli route mimarisi ve temel admin görsel dili.** Gerçek route'lar, tam sayfa editörler, sayfalanmış listeler ve admin tokenları mevcut.
- **Spec 2 — Üretime hazırlık/güvenlik başlıkları ve hata yüzeyleri.**
- **Spec 3 — Üçüncü parti CDN asset sahiplenmesi.**
- **Spec 5 — Public shell/site settings bağlantısı.**
- **Spec 7 — Yönetim IA ve Ayar Merkezi.** Shared admin editör primitives, kategori tabanlı Site Ayarları, iki kolonlu collection editörleri ve Blog/Hero terminolojisi mevcut. Ayrı Site İçeriği editörü sonraki Home cutover'ında kaldırıldı.

### Arşivlenmiş, çalıştırılmayacak belgeler

- **Spec 4:** Güncel disk hedeflenen eski collection locale modellerini içermiyor; page/section cutover Spec 8, external import Spec 16 tarafından kapsanıyor.
- **Spec 6:** Önceki tracker “tamamlandı” diyordu ancak disk üzerinde rol/users route/ilişkisel yazar yok. Belge Spec 12 ile değiştirildi. Eski tamamlanma iddiası geçersizdir.

## Yeni Uygulama Sırası

En güvenli varsayılan seri sıradır. Kullanıcı spec'leri tek tek uygulatabilir:

| Sıra | Spec | Durum | Görünür çıktı | Ana sahiplik |
| --- | --- | --- | --- | --- |
| 1 | **Spec 7 — Yönetim IA ve Ayar Merkezi** | Tamamlandı | responsive iki kolon/grid editörler, düzenli Site Ayarları, Blog/Hero terminolojisi; eski Site İçeriği route'u kaldırıldı | admin UI primitives, site settings, editor layout |
| 2 | **Spec 8 — Reusable Section Mimarisi** | Kapsam dışı bırakıldı | Ürün kararı: sayfa yapısı kodda sabit kalır. `ReusableSection`/`PageLayout`/`PageSection` tabloları legacy şema olarak durur, hiçbir runtime yolu okumaz | Prisma, content domain |
| 3 | **Spec 9 — Tüm Sayfalar ve Page Builder** | Kısmi | Sayfa yapısı kodda sabit; 14 public sayfa için dil bazlı sabit metin editörü, Home için tam alan editörü (metin/görsel/ikon/buton/link + koleksiyon grid/adet/seçim). **Eksik:** sayfa bazlı preview yüzeyi | pages admin UI/actions |
| 4 | **Spec 10 — Çeviri Prompt/JSON Akışı** | Kısmi | `exportEntityForTranslation` + atomik draft `importTranslationsAtomically` ve server action'ları var. **Eksik:** editör içi UI yüzeyi (action'lar henüz hiçbir ekrandan çağrılmıyor) | translation package/import |
| 5 | **Spec 11 — SEO Merkezi** | Kısmi | route bazlı SERP/sosyal önizleme üretimi + `/manage/seo` üzerinde canlı örnek önizleme. **Eksik:** route listesi UI'ı, advanced override/schema/alt yönetimi | SEO resolver, `/manage/seo` |
| 6 | **Spec 12 — Profil, RBAC ve Blog Yazarı** | Tamamlandı | SUPER_ADMIN/ADMIN/AUTHOR, kullanıcı/profil/şifre/avatar, gerçek post author | Prisma AdminUser, auth, users/profile/posts |
| 7 | **Spec 13 — Audit Terminali** | Tamamlandı | cursor tabanlı ileri/geri geçmiş (sayfa kaymasız), yalnız metadata alan adları gösterilir | audit query/UI |
| 8 | **Spec 14 — Archive ve Hard Delete** | Kısmi | SUPER_ADMIN şifresiyle açılan 15 dk'lık Developer Mode capability + `/manage/users` yüzeyi. Kalıcı silme mevcut `deleteEntityIfSafe` (published/live-route guard) yolunda kalır. **Eksik:** dev-mode gate'inin list view silme akışlarına bağlanması | lifecycle/delete, capability |
| 9 | **Spec 15 — Admin Performansı** | Kısmi | `LazyEditorBoundary` ağır TipTap editörlerini ilk paint sonrasına erteler (site-settings yasal metinler, About açıklama). **Eksik:** production before/after ölçümü | admin client boundaries |
| 10 | **Spec 16 — Metro İçerik Importu** | Hazır | Uygulanmadı: önceki tur yalnızca bootstrap çağıran no-op bir harness eklemişti, kaldırıldı. Gerçek source envanteri/import yazılmadı | import script, mapping |

Uygulama komutları sırasıyla `spec-7 uygula` … `spec-16 uygula`.

## Bağımlılık Grafiği

```text
Spec 7
  ├─> Spec 8 ─> Spec 9 ─> Spec 10
  │                    └─> Spec 11
  └─> Spec 12 ─> Spec 13
              └─> Spec 14  (ayrıca Spec 8 + 9)

Spec 7–14 ─> Spec 15 ─> Spec 16
```

### Sınırlı paralellik

Kullanıcı seri uygulatmayı planladığı için önerilen sıra yukarıdadır. Paralellik özellikle istenirse:

- Spec 10 ve Spec 13, Spec 12 tamamlandıktan sonra **ayrı worktree/temiz kopya** ve kesin dosya sahipliği ile paralel olabilir.
- Spec 8, 9, 11, 12, 14, 15 ve 16 şema veya ortak cross-cutting dosya sahipliği nedeniyle seri tutulur.
- Aynı `/Users/berat/extech` checkout'una iki writer aynı anda yazmaz.

## Onaylanmış Ürün/Mimari Kararları — Henüz Uygulanmadı

- Mevcut admin CSS tokenları korunur; referans yalnız layout/hiyerarşidir.
- Page layout sırası locale'den bağımsız/global; section içerikleri TR/EN/RU/AR revision'larıdır.
- Reuse aynı section kimliğini paylaşır; clone yeni kimlik üretir.
- Çeviri importu üç locale için atomik ve draft-only; harici LLM API entegrasyonu yok.
- SEO otomatik türetilir; public metadata yalnız publish sonrası değişir. Advanced override same-origin canonical ve güvenli JSON-LD ile sınırlı.
- Developer Mode global boolean değil, SUPER_ADMIN için şifreyle açılan 15 dakikalık session capability'sidir.
- Hard delete blocker'ları sessiz cascade etmez; yalnız owned veri transaction içinde silinir.
- Audit geçmişi cursor bazlıdır; eski kayıtlar üstten prepend edilir ve scroll anchor korunur.
- Metro site importu runtime bağımlılığı değil, allowlisted/idempotent CLI migration'ıdır; kaynakta olmayan dil/yasal içerik uydurulmaz.
- `(panel)` altında `loading.tsx` kullanılmaz ve mutasyon sonrası `router.refresh()` eklenmez.

## Spec Teslim Kuralı

Her spec tamamlanmadan sonraki spec'e geçilmez:

1. Belgede listelenen kabul kriterleri gerçek davranışla sağlanır.
2. Migration varsa expand/backfill/parity/cutover/contract sırası ve geri alma bilgisi vardır.
3. Gerçek admin→public browser senaryosu çalışır; dizin/branch/SHA kaydedilir.
4. `npx tsc --noEmit`, `npx eslint .`, ilgili testler ve `npm run build` geçer.
5. İlgili context dosyaları ve bu tracker yalnız uygulanmış gerçeğe göre güncellenir.
6. Test/preview verisi ve geçici script/artifact temizlenir.

## Open Questions

Ürün kararını bloke eden açık soru yok. Spec 16 source'ta bulunmayan hukuki veya locale içeriklerini uydurmak yerine `missing-source-content` olarak raporlar; gerçek metin sağlanana kadar eksik statüde kalır.

## Session Notes

- Yerel geliştirme: Next.js 16.3.4 + Turbopack, PostgreSQL `localhost:5432/extech`.
- Extech dev server bu güncelleme sırasında port 3900 üzerinde çalıştı; tarayıcıda `/manage/home` üzerinden hero metin/buton/link, süreç adımı ikonu (medya yükleme dahil) ve hizmet bölümünün grid/adet/seçim ayarları düzenlenip yayınlandı, public anasayfada doğrulandı ve test verisi geri alındı. `/manage/pages/copy/faq` düzenlemesi `/sss` sayfasında görüldü ve geri alındı.
- Port 3000 başka proje tarafından kullanılabilir; uygulama doğrulamasında working directory kontrol edilir.
- Kaynak sitemap snapshot'ı 2026-09-08 tarihinde root, indeks/statik sayfalar, 6 hizmet, 2 proje, 4 blog ve 2 ekip detayını içeriyordu; Spec 16 çalışma anında envanteri yeniden üretir.
