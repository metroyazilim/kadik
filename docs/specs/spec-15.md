# Spec 15 — Yönetim Paneli İstemci Gezinme ve Editör Performansı

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-15 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 7–14 tamamlandıktan sonra uygulanır; yeni ekranların tamamını ölçer  
**Paralellik:** Tek başına ve son optimizasyon birimi; admin route/query/client boundaries genelini sahiplenir

## 1. Problem

Kullanıcının gözlemi: yönetim panelinde bir alana tıklayınca özellikle client-side navigation yavaş kalıyor. Bu gözlem ground truth'tur. Çözüm loading animasyonu ekleyip gecikmeyi saklamak değil; route geçişinin ağ, RSC, DB sorgusu, hydration, JS parse ve ağır editör mount maliyetlerini ölçüp kaynağı azaltmaktır.

Spec 1 route başına gerçek sayfa ve dar liste sorguları getirmiştir. Spec 7–14 yeni page builder, SEO, audit, RBAC ve tablo davranışları ekleyeceği için performans son entegrasyon halinde tekrar ele alınır.

## 2. Hedef

- Sidebar/list/editor navigasyonu tek, bounded RSC turuyla tamamlanır.
- Route açılışında ihtiyaç olmayan Tiptap, MediaPicker, translation import ve JSON-LD editör kodu yüklenmez/mount edilmez.
- Liste route'ları payload gövdelerini ve bütün locale içeriklerini çekmez.
- Edit route yalnız seçili entity/page + aktif locale + görünür bölümün gerekli verisini çeker.
- Kullanıcı tıklamasına anında link-local pending geri bildirimi gelir; eski içerik sessizce donmuş görünmez.
- Next.js 16.3.4'te doğrulanmış soğuk Suspense problemi nedeniyle `(panel)` altına `loading.tsx` eklenmez.
- İyileştirme before/after üretim build ölçümüyle kanıtlanır.

## 3. Ölçüm Önce

Uygulama başlamadan ve bittikten sonra aynı deterministic seed üzerinde aynı senaryo ölçülür.

### 3.1 Ortam

- `npm run build` + `npm run start -- --port <boş-port>`; development/Turbopack HMR süreleri başarı metriği değildir.
- Doğru `workingDirectory`, branch ve SHA `/api/dev-tools/server-identity` benzeri mevcut guard ile doğrulanır; production'da endpoint kapalıysa terminal SHA + process cwd kaydı.
- Yerel PostgreSQL, warm DB connection; cold ve warm navigasyon ayrı rapor.
- Browser cache temiz/cold ve ikinci/warm run.
- Temsilî veri: en az 100 service/post, 40 page/section, 500 audit, 200 media metadata; binary medya indirme ölçümden ayrılır.

### 3.2 Senaryo matrisi

1. Login → Dashboard.
2. Dashboard → Services list.
3. Services list → service editor.
4. Sidebar → Pages list.
5. Pages list → About page builder.
6. Page builder'da rich-text section açma.
7. Sidebar → SEO, route seçme.
8. Sidebar → Audit, older batch prepend.
9. Sidebar → Site Settings, kategori değişimi.
10. Blog author → Posts list/editor.

### 3.3 Toplanacak kanıt

- Click timestamp → URL change → first meaningful heading changed → pending cleared.
- RSC/document/fetch request sayısı ve transferred/decoded byte.
- Server-Timing: auth, primary query, secondary queries, compose, total.
- Prisma query count ve yavaş sorgular (yalnız ölçüm modunda; production secret/data log yok).
- Hydration sonrası long tasks (>50ms), JS heap delta ve mounted rich editor sayısı.
- Route client chunk listesi ve gzip boyutu.
- Tekrarlanan aynı query/action çağrısı.

Ölçüm script'i `scripts/measure-admin-navigation.ts` veya Playwright ölçüm projesi olarak deterministic çalışır; sonuç raporu artifact/test output'tur, uygulama kodunda debug log bırakmaz.

## 4. Kabul Bütçeleri

Aynı workstation ve production build üzerinde:

- Liste navigasyonu warm median ≤ 500ms, p95 ≤ 1000ms.
- Normal edit route warm median ≤ 700ms, p95 ≤ 1400ms.
- Hiçbir tek route geçişi aynı URL için birden fazla RSC GET veya istemci edit-view refetch'i yapmaz.
- Services/posts gibi 20 satırlık liste RSC decoded payload ≤ 100KB ve revision JSON body içermez.
- Pages list payload ≤ 100KB; yalnız seçili page editor page/section draft payload'ını alır.
- Route geçişinde 100ms üstü main-thread long task yok; ağır section açılışında ölçülen long task before'a göre en az %30 azalır ve 200ms'i aşmaz.
- Kapalı/hiç açılmamış rich-text section için Tiptap editor instance sayısı 0'dır.
- MediaPicker kapalıyken asset grid query/request ve picker chunk yüklenmez.
- Site Settings kategori değişimi yeni RSC route navigation gerektirmez; aktif payload zaten varsa client state/URL history ile ≤100ms görsel değişim.

Bu mutlak hedeflerden biri altyapı nedeniyle sağlanamazsa kapsam sessizce düşürülmez: before/after, bottleneck ve ulaşılabilir minimum raporlanır; spec tamamlanmış sayılmaz.

## 5. Server Render ve Query Kuralları

- Admin route'ları server component kalır; bütün sayfayı client component'e çevirmek yasaktır.
- Auth identity aynı request içinde React `cache()` veya mevcut request memoization ile bir kez çözülür; cross-request stale role cache yok.
- Bir route'taki bağımsız count/list/status sorguları `Promise.all` ile çalışır.
- Liste query'leri `select`, `take`, cursor/page sınırı; revision payload yok.
- Edit query aktif locale'i çeker. Dört locale için yalnız pointer/status; payload yalnız seçili locale.
- Page Builder ilk render collapsed section'lar için gerekli hafif summary + aktif/açık section payload modelini kullanır. Bütün dört locale ve bütün revision history çekilmez.
- SEO route listesi payload'sız; yalnız seçili route detail metadata kaynağı.
- Audit cursor query max 100.
- `force-dynamic` yalnız auth/cookies yüzünden doğal dynamic davranış yetmiyorsa kullanılır; her route'a kör eklenmez.
- Admin data cross-user shared route cache'e konmaz. Per-request memoization ve DB indeksleri tercih edilir.
- N+1 section/media/author query'leri relation include yerine bounded bulk query ile çözülür.

## 6. Client Boundary ve Lazy Mount

### 6.1 Accordion içeriği

- `EditorSection` başlığı ve hafif inputs normal mount olabilir.
- Tiptap, media gallery, large sortable list, translation import preview, custom JSON-LD editor yalnız section ilk kez açıldığında dynamic import/mount.
- Bir kez açılan section kapanınca dirty state kaybolmaz. Keep-alive maliyeti ölçülür; çok sayıda editor varsa state serialize + unmount stratejisi ancak correctness testiyle.
- Aynı anda en fazla gerekli rich-text editor instance'ları; About açılışında bütün uzun metin editorleri mount edilmez.

### 6.2 Media Picker

- Dialog açılmadan asset listesi fetch edilmez.
- Pagination/cursor ve thumbnail boyutları bounded.
- Picker kapanınca object URLs/listeners temizlenir; seçili MediaAsset metadata form state'inde kalır.

### 6.3 Page ve SEO editörleri

- Route listesi/server shell ile selected detail ayrılır.
- Arama input'u URL/server request'i debounce eder; her keypress bütün route'u yeniden render etmez.
- SERP preview saf client hesap; her input'ta server call yok.
- Drag/reorder hareketleri local; drop/save'de tek server action.

### 6.4 Translation panel

- Export/import kodu panel açılmadan chunk'a girmez.
- Clipboard/export üretimi server authorization gerektiriyorsa tek action; her keystroke parse server request yapmaz.
- Preflight explicit button ile.

## 7. Navigasyon

- Sidebar ve tablo linkleri gerçek `<Link>` olarak kalır.
- Tıklama sonrası link/üst bar üzerinde anında `aria-busy` ve küçük pending indicator görünür; tüm sayfayı skeleton ile kaplamaz.
- Uygulama sırasında kurulu Next.js 16.3.4 dokümantasyonundan `useLinkStatus`/Navigation API'nin gerçek desteklenen şekli okunur. Destek yoksa mevcut `useTransition` wrapper yalnız pending sunumu için kullanılabilir; route verisini client fetch etmez.
- `(panel)/**/loading.tsx` eklenmez.
- Prefetch politikası ölçümle belirlenir:
  - bütün sidebar route'larını açılışta eager prefetch etmek ağ/CPU'yu artırıyorsa kapatılır,
  - hover/focus intent veya viewport prefetch yalnız hafif list route'larında,
  - edit detail route list row link'leri Next'in production prefetch davranışıyla ölçülür.
- Navigasyon sırasında global `router.refresh()` veya `window.location` full reload yok.

## 8. Mutasyon Sonrası

- Save/publish/archive/reorder sonrası aynı veriyi tekrar isteyen client action zinciri yok.
- Server action normalized sonucu ve yeni version/status döndürür veya redirect eder.
- `revalidatePath` yalnız hedef admin/public route; kök `/manage` toplu invalidation yok.
- `revalidateTag` section usage/route registry ile hedefli.
- Optimistic UI server conflict/error'da rollback.
- Toast göstermek için route refresh yapılmaz.

## 9. Database ve İndeksler

Ölçümde kullanılan sorguların `EXPLAIN (ANALYZE, BUFFERS)` çıktısı yalnız geliştirme DB'sinde incelenir. Beklenen indeksler:

- ContentEntity `(contentType, archived, order)` gerektiğinde additive composite index.
- ContentTranslation `(entityId, locale)` mevcut unique.
- ContentRoute locale/type/path lookup.
- ManagedPage archived/name veya filtre query'si.
- ReusableSection kind/archived/updatedAt.
- PageLayoutPlacement section/revision/order.
- Audit `(createdAt,id)` compound cursor için composite index; yalnız `createdAt` yetersizse migration.
- AdminUser role/active list.

Kullanılmayan spekülatif index eklenmez; gerçek query plan kanıtı gerekir.

## 10. Metro Kaynak Sisteminin Kullanımı

Kullanıcının “ana metroyazilimdaki sistemi kullanabiliriz” talebi şu sınırda uygulanır:

- Referans sistemin hızlı sayfa geçişi, içerik hiyerarşisi ve route-local veri desenleri davranış karşılaştırması için incelenebilir.
- `metroyazilim.com` runtime API/scraping bağımlılığı admin navigasyonuna eklenmez.
- İçerik migration'ı Spec 16'da offline/idempotent script'tir.
- Başka uygulamanın mock client state'i veya farklı framework cache varsayımları kör kopyalanmaz.

## 11. Dosya Sahipliği

Cross-cutting olduğu için uygulama başında exact file manifest çıkarılır. Muhtemel sahiplik:

- `app/manage/(panel)/**/page.tsx` query orchestration
- `components/admin/AdminSidebar.tsx`, navigasyon pending primitive
- Ağır editor/picker components ve dynamic boundaries
- `lib/content-model/*-admin.ts` list/edit query'leri
- `lib/admin-auth.ts` request memoization (permission semantiği değiştirmeden)
- Prisma additive indexes migration
- `scripts/measure-admin-navigation.ts` ve dar performans doğrulama harness'i

Public component görsel tasarımı, data schema semantiği ve business feature'ları değiştirilmez.

## 12. Kabul Kriterleri

1. **AC-15.1** Before/after production-build raporu §3 matrisindeki tüm senaryolar için süre/request/byte/query/long-task verisi içerir.
2. **AC-15.2** §4 navigasyon ve payload bütçeleri aynı seed/workstation koşulunda sağlanır.
3. **AC-15.3** Her route click tek RSC navigation yapar; duplicate edit-view action veya full reload yoktur.
4. **AC-15.4** List query'leri revision payload gövdesi çekmez; aktif locale dışındaki payload edit route'a gelmez.
5. **AC-15.5** Kapalı rich-text section Tiptap instance/chunk mount etmez; açıldığında içerik ve dirty state doğru çalışır.
6. **AC-15.6** Kapalı MediaPicker asset listesi istemez; dialog açıkken bounded pagination kullanır.
7. **AC-15.7** Sidebar/list link pending feedback'i tıklamadan sonraki ilk frame'lerde görünür ve screen reader için `aria-busy`/status sağlar.
8. **AC-15.8** `(panel)` altında `loading.tsx`, mutation sonrası `router.refresh()` ve admin runtime'da metroyazilim.com fetch yoktur.
9. **AC-15.9** Reorder/search/SEO preview her etkileşimde server round-trip yapmaz; explicit save/preflight tek request'tir.
10. **AC-15.10** Eklenen DB index'lerin her biri ölçülen query plan ile gerekçelendirilir; spekülatif index yoktur.
11. **AC-15.11** Optimizasyon bütün Spec 7–14 browser acceptance akışlarını bozmaz.

## 13. Test ve Gerçek Doğrulama

- Performans script'ini before ve after aynı build/seed ile çalıştır; JSON/console summary artifact üret.
- Browser Performance paneli/PerformanceObserver ile route heading ve pending state timing ölç.
- Ağ request listesini assertion ile say.
- DB query logger yalnız test env'de count/shape yakalar.
- Mevcut davranış E2E'leri çalışır.
- `npx tsc --noEmit`, `npx eslint .`, ilgili testler, `npm run build`.

Kalıcı test yalnız request duplication, payload/query boundary veya lazy mount regresyonunu gerçekten yakalıyorsa eklenir. Milisaniye eşiğini genel E2E suite'e flaky assertion olarak koymak yerine dedicated performance harness raporlar ve CI ortamına göre ayrı bütçe kullanır.

## 14. Riskler

- **Loading ile semptom gizleme:** pending UI var fakat başarı yalnız ölçülen süre azalmasıdır.
- **Aggressive shared cache:** admin role/content stale olabilir; cross-request cache yerine request memoization.
- **Lazy mount veri kaybı:** dirty state ve validation E2E ile korunur.
- **Prefetch aşırı yük:** karar ölçümle; global açık/kapalı dogma yok.
- **Dev ölçümü:** production build zorunlu.
- **Aşırı client state:** route data client store'a taşınmaz; RSC/server action modeli korunur.

## 15. Definition of Done

- Before/after kanıtı ve §4 bütçeleri sağlanmıştır.
- Kullanıcının yavaş hissettiği sidebar→liste→editör akışları gerçek production browser'da belirgin ve ölçülebilir hızlanmıştır.
- Ağ/DB/JS maliyeti kaynakta azaltılmış, yalnız animasyon eklenmemiştir.
- Spec 7–14 davranışları korunmuştur.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- Performans kararları `code-standards.md`, sonuçlar `progress-tracker.md` içine gerçek ölçümlerle yazılmıştır.
