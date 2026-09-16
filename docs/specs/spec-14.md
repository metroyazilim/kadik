# Spec 14 — Koleksiyon Tabloları, Archive Switch ve Güvenli Developer Mode Hard Delete

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-14 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 8, Spec 9 ve Spec 12 tamamlanmış olmalıdır; SUPER_ADMIN rolü olmadan Developer Mode uygulanmaz  
**Paralellik:** Tek başına uygulanır; bütün collection list view'ları ve delete/archive domain servisi bu birimin sahibidir

## 1. Problem

Mevcut koleksiyon listelerinde:

- Arşivleme metin düğmesi/dialog akışıyla temsil ediliyor; hızlı ve anlaşılır bir state kontrolü değil.
- Satır kolonları, durum bildirimleri ve archive sonucu yerleşimi bozabiliyor.
- İşlem sonucu tablonun altına/arasına eklendiğinde tablo sıçrıyor veya satırlar dağılmış görünüyor.
- Kalıcı silme yalnız bağımlılık dialog'unda parçalı biçimde var; kullanıcı tarafından açıkça etkinleştirilen güvenli bir Developer Mode kontratı yok.
- Hizmet, ürün, proje, ekip, SSS, blog, sayfa ve reusable section için yaşam döngüsü aynı kurala bağlı değil.

## 2. Karar

- Archive/unarchive satır içi erişilebilir `Switch` olur; state server authority ile optimistic güncellenir.
- Bütün yönetim tabloları aynı `AdminDataTable`/row action kontratını kullanır.
- Mutasyon sonucu yalnız toast ve satırın kendi pending/error durumu ile gösterilir; akışa yeni paragraf/card eklenmez.
- Kalıcı silme yalnız **SUPER_ADMIN + kısa ömürlü, şifreyle tekrar doğrulanmış Developer Mode** oturumunda görünür.
- Developer Mode global site ayarı değildir. Başka adminleri etkileyen kalıcı boolean saklanmaz; imzalı HttpOnly session capability'si en fazla 15 dakika geçerlidir.
- Hard delete bağımlılık raporunu atlamaz. “Her şeyi sil” orphan veya gizli public bozulma anlamına gelmez.

## 3. Kapsam

### Kapsam içi

- Services, products, projects, team, faq, posts, pages, reusable sections ve uygun medya listelerinde ortak tablo satırı.
- Archive switch, optimistic rollback, stable feedback.
- Aktif/Arşivli/Tümü filtreleri.
- Settings/Profile alanından Developer Mode aktivasyonu ve kapatma.
- Hard delete preflight, confirmation, transaction, audit tombstone ve cache invalidation.
- Entity tipine göre owned child veri temizliği.
- Dependency blocker ve ilgili kayda navigasyon.

### Kapsam dışı

- Mesajların hard delete'i. Message modeli gizlilik/saklama politikası ayrı karardır; bu spec yalnız mevcut archive/status davranışını düzenleyebilir.
- Audit log'ların hard delete'i.
- Admin kullanıcılarının hard delete'i; Spec 12 deactivation kullanır.
- Published bağımlılıkları sessizce kaldıran zorlayıcı cascade.
- R2 storage lifecycle politikasını değiştirmek. Medya hard delete mevcut usage kurallarına uyar.

## 4. Ortak Tablo Kontratı

Yeni veya mevcut tek tablo primitive'i:

- Semantic `<table>`; CSS grid ile sahte tablo yapılmaz.
- Responsive: masaüstünde sabit başlık/satır kolonları; mobilde yatay kontrollü scroll veya accessible stacked row, başlık-değer ilişkisi kaybolmaz.
- Kolonlar content type'a göre registry'den gelir fakat çekirdek kolonlar aynıdır:
  1. seç/drag (gerekiyorsa),
  2. başlık + slug,
  3. locale durumları,
  4. güncelleme,
  5. Arşiv switch,
  6. işlemler.
- Header ve body aynı `colgroup`/table layout kullanır; satır içinde bağımsız grid breakpoint'i yoktur.
- Uzun başlık ellipsis + accessible title; kolon itmez.
- Row mutation sırasında tüm tablo disable olmaz; yalnız ilgili kontrol pending.
- Başarı toast'ı overlay/portal olarak çıkar; tablo yüksekliğini değiştirmez.
- Hata ilgili satırda küçük `role="alert"` açıklama + toast; yeni full-width satır eklemez.

## 5. Archive Switch

### 5.1 Görsel/erişilebilir davranış

- Label: aktif kayıtta “Aktif”, arşivlide “Arşivde”; yalnız renk kullanılmaz.
- Native checkbox semantics veya mevcut erişilebilir switch primitive'i; `role="switch"`, `aria-checked`.
- Toggle tıklanınca local row state optimistic değişir ve pending spinner gösterir.
- Server başarısızsa önceki state geri gelir; açık hata.
- Keyboard Space ile çalışır.
- Arşivleme public route/cache davranışını etkiliyorsa confirmation yalnız published kayıt için açılır; draft-only kayıtta hızlı toggle olabilir.

### 5.2 Domain davranışı

- `setEntityArchived(context, entityId, archived, expectedVersion)` tek ortak servistir.
- Content type ve permission server'da doğrulanır.
- Archive, published pointer'ı/revisions'ı silmez. Public resolver arşivli entity'yi sunmaz; ilgili ContentRoute davranışı mevcut invariant'a göre kaldırılır veya inactive hale getirilir. Tek karar tüm tiplerde aynıdır.
- Unarchive eski published route'u otomatik geri getirecekse route collision tekrar doğrulanır; collision varsa unarchive reddedilir ve edit/publish gerekir.
- Audit + entity version + route/cache invalidation aynı transaction'da.

## 6. Filtre ve Sıra

- Liste varsayılanı Aktif.
- Tabs/query: `status=active|archived|all`.
- Arşivlenen satır active görünümünde mutation başarıyla tamamlandıktan sonra kontrollü biçimde fade/remove olur; tablo header/pagination kalır.
- Sayfadaki son satır arşivlenirse geçerli önceki sayfaya server redirect/navigation yapılır; boş ve geçersiz page bırakılmaz.
- Sort/reorder yalnız active kayıtlar üzerinde; archived kayıtların eski global order'ı aktif listeyi bozmaz.

## 7. Developer Mode

### 7.1 Aktivasyon

Settings/Profile altında yalnız SUPER_ADMIN için “Developer Mode” kartı:

1. Risk açıklaması.
2. Mevcut şifre alanı.
3. “15 dakika etkinleştir” düğmesi.
4. Aktifken kalan süre ve “Şimdi kapat”.

Server:

- Şifre bcrypt/argon mevcut auth yöntemiyle tekrar doğrulanır.
- İmzalı HttpOnly, Secure (production), SameSite=Lax capability cookie: userId, tokenVersion, issuedAt, expiresAt, scope=`hard-delete`.
- DB'de global `developerMode=true` tutulmaz.
- Role/tokenVersion değişirse capability geçersiz.
- 15 dakika sonunda otomatik sona erer.
- Aktivasyon/kapatma/başarısız deneme audit'e içerik sızdırmadan yazılır.

### 7.2 Yetki savunması

UI'da düğmeyi gizlemek güvenlik değildir. Her hard delete server action:

- güncel session,
- `role === SUPER_ADMIN`,
- capability signature/scope/expiry/tokenVersion,
- CSRF korumalı server action origin,
- fresh dependency preflight token

kontrollerini tekrar yapar.

## 8. Hard Delete Akışı

1. Kayıt önce arşivlenmiş olmalıdır. Aktif/published görünür kayıt doğrudan hard delete edilemez.
2. “İşlemler → Kalıcı sil” yalnız Developer Mode aktifken görünür.
3. Server `buildHardDeletePlan` çağrısı fresh dependency raporu ve kısa ömürlü imzalı plan token'ı döndürür.
4. Dialog içerir:
   - kayıt adı/tipi,
   - silinecek owned child sayıları,
   - blocker'lar ve linkleri,
   - geri alınamaz uyarısı,
   - exact confirmation text: kayıt slug/key'i.
5. Blocker varsa delete düğmesi disabled; kullanıcı blocker'ı ilgili ekranda çözer.
6. Onay sonrası server dependency/version'ı yeniden kontrol eder.
7. Tek transaction: audit tombstone hazırlanır, owned rows silinir, root silinir, outbox/cache olayları yazılır.
8. Storage object silme transaction içinde yapılmaz. Media hard delete için durable storage cleanup job/outbox kullanılır; DB rollback ile R2 kaybı ayrıştırılır.
9. Başarıda listeye redirect/toast; satırın altında mesaj yok.

## 9. Owned Veri ve Blocker Matrisi

### 9.1 Content collection entity (service/product/project/team/faq/post)

Owned ve silinebilir:

- kendi ContentTranslation kayıtları,
- immutable revisions (pointer'lar kontrollü null/silme sırasıyla),
- kendi ContentRoute kayıtları,
- kendi MediaUsage kayıtları,
- entity-specific join/registry satırları,
- draft-only page feed selections yalnız açık policy ile.

Blocker:

- published reusable/page placement referansı,
- başka entity'nin explicit relational selection'ı,
- korunması gereken external relation.

### 9.2 ManagedPage

Owned:

- page-level entity/translation/revisions/routes,
- page layout ve bütün layout revisions/placements.

Blocker:

- `system=true` sayfa hiçbir koşulda hard delete edilmez.
- Navigasyon/site settings referansı önce kaldırılıp yayınlanmalıdır.

Page silmek referenced ReusableSection'ları silmez; yalnız placements silinir.

### 9.3 ReusableSection

Owned:

- section entity/translation/revisions/media usages.

Blocker:

- herhangi bir draft veya published PageLayoutPlacement. Kullanıcı önce placement'ları kaldırıp ilgili layout draft/publish akışını tamamlar.

### 9.4 MediaAsset

Mevcut MediaUsage blocker'ı korunur. Usage yoksa:

- DB row silme + storage cleanup event.
- Cleanup retry/idempotency.
- Storage başarısızlığı audit/operasyon finding; silinmiş DB kaydı geri yaratılmaz.

## 10. Audit Tombstone

Silinen entity artık join edilemeyeceği için audit metadata minimum güvenli snapshot taşır:

- entityType, deletedEntityId, adminDisplayName/internal title, slug/key, locale route listesi,
- owned row counts,
- deletion plan hash,
- actor userId,
- timestamp.

Tam revision payload, rich text, kişisel form verisi veya secret audit'e kopyalanmaz. Audit row root silme transaction'ında kalır; `entityId` string olarak tutulabilir.

## 11. Dosya Sahipliği

- Bütün `*ListView.tsx` collection list bileşenleri
- `components/admin/AdminDataTable.tsx` (yeni veya mevcut table clean cutover)
- `components/admin/ArchiveSwitch.tsx`
- `components/admin/ArchiveDeleteDialog.tsx` temiz cutover
- `lib/content-model/entity-lifecycle.ts`
- `lib/content-model/hard-delete.ts`
- Collection/page/section/media archive/delete actions
- Settings/Profile Developer Mode kartı
- Auth capability helper yalnız bu scope için
- Gerekirse deletion outbox migration/modeli

Spec 12 auth rolü tamamlanmadan uygulanmaz. `prisma/schema.prisma` yalnız durable storage deletion outbox gerçekten mevcut modelle karşılanamıyorsa değişir.

## 12. Kabul Kriterleri

1. **AC-14.1** Services/products/projects/team/faq/posts/pages/sections listeleri aynı tablo hizalama ve action kontratını kullanır; header/body kolonları tüm breakpoint'lerde eşleşir.
2. **AC-14.2** Archive state `role="switch"` ile gösterilir; mouse ve keyboard ile çalışır.
3. **AC-14.3** Başarılı archive/unarchive sonucu tablo akışına mesaj satırı/kartı eklemez; yalnız toast ve row state kullanır.
4. **AC-14.4** Server hatasında optimistic state rollback olur ve satır yerleşimi bozulmaz.
5. **AC-14.5** Active/Archived/All filtreleri URL ile çalışır; son satır arşivleme invalid pagination bırakmaz.
6. **AC-14.6** Developer Mode yalnız SUPER_ADMIN'a görünür, mevcut şifreyle açılır, 15 dakika içinde biter ve global ayar değildir.
7. **AC-14.7** ADMIN/AUTHOR veya capability'siz doğrudan hard delete server action çağrısı 403 döner; UI gizleme tek savunma değildir.
8. **AC-14.8** Hard delete yalnız arşivli kayıt ve fresh dependency planıyla yapılır; confirmation slug/key birebir eşleşir.
9. **AC-14.9** Published/draft dependency blocker varken section/content delete edilmez ve blocker linkleri gösterilir.
10. **AC-14.10** Başarılı hard delete root + owned translations/revisions/routes/usages'ı orphan bırakmadan siler; başka reusable entity/media kaydı silinmez.
11. **AC-14.11** Delete işlemi audit tombstone + invalidation ile atomiktir; raw içerik audit'e kopyalanmaz.
12. **AC-14.12** Media storage cleanup durable/retryable'dır; DB transaction içinde R2 çağrısı yapılmaz.
13. **AC-14.13** System page, audit log, message ve admin user hard delete bu UI'dan yapılamaz.

## 13. Test ve Gerçek Doğrulama

### Kalıcı testler

- Archive optimistic success/rollback observable UI state.
- Permission/capability expiry/tokenVersion.
- Dependency TOCTOU: preflight sonrası yeni blocker eklenirse delete reddi.
- Cascade ownership ve unrelated row korunumu.
- Audit tombstone + rollback.
- Storage cleanup outbox idempotency.
- Pagination last-row behavior.

### Browser senaryosu

1. Normal ADMIN ile Developer Mode kartı/düğmesi olmadığını doğrula.
2. SUPER_ADMIN ile yanlış şifre → reddedilir; doğru şifre → 15 dk aktif.
3. Test hizmetini archive switch ile arşivle; active listeden stabil biçimde çıksın, archived filtrede görünsün.
4. Dependency ekle; hard delete dialog blocker gösterip disable olsun.
5. Dependency'yi normal edit akışında kaldır/yayınla; fresh plan üret; exact slug ile sil.
6. Public route 404/registry sonucu, DB owned row yokluğu ve audit tombstone'u doğrula.
7. Developer Mode'u kapat; direct action tekrar 403.
8. Test verisini temizle.

### Komutlar

- `npx prisma validate` (şema değiştiyse migration)
- `npx tsc --noEmit`
- `npx eslint .`
- ilgili integration/E2E testleri
- `npm run build`

## 14. Riskler

- **Global tehlikeli mod:** per-session capability kararı bunu engeller.
- **TOCTOU:** plan token tek başına yeterli değil; delete transaction fresh dependency kontrolü yapar.
- **Aşırı cascade:** yalnız owned relation'lar; shared/referenced nesneler blocker.
- **R2/DB bölünmesi:** durable cleanup outbox.
- **Tablo sıçraması:** status content normal DOM akışına eklenmez, row key stabil kalır.
- **Archive route collision:** unarchive öncesi registry collision kontrolü.

## 15. Definition of Done

- Tüm hedef listelerde düzgün hizalı, responsive ortak tablo ve archive switch vardır.
- Developer Mode güvenli, kısa ömürlü ve SUPER_ADMIN sınırındadır.
- Permanent delete gerçek content/page/section kayıtlarında dependency-safe ve auditli çalışır.
- Gerçek browser'da archive, rollback, blocker, delete ve capability expiry/disable akışı kanıtlanmıştır.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- `architecture.md`, `ui-context.md` ve `progress-tracker.md` gerçek duruma güncellenmiştir.
