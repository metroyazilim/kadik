# Spec 13 — Terminal Tarzı Audit Geçmişi ve Yukarı Kaydırarak Eski Kayıt Yükleme

**Durum:** Hazır — uygulanmadı  
**Uygulama komutu:** `spec-13 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 7 ve Spec 12 tamamlanmış olmalıdır  
**Paralellik:** Spec 10 ile dosya sahipliği çakışmıyorsa paralel olabilir; `AuditPanel`, audit query ve `/manage/audit` bu birimin sahibidir

## 1. Hedef

Mevcut sonlu audit listesi, terminal/log görüntüsüne dönüşür. Ekran ilk açıldığında en yeni kayıtlar altta görünür. Kullanıcı yukarı kaydırdığında daha eski geçmiş üst tarafa eklenir; mevcut scroll konumu sıçramaz. Filtre, detay ve gerçek kullanıcı/entity linkleri korunur.

## 2. Görünür Sonuç

- `/manage/audit` mevcut admin tokenlarıyla koyu terminal yüzeyi kullanan bir olay akışı gösterir.
- İlk batch kronolojik olarak yukarıdan eski → aşağıdan yeni görünür ve viewport en yeni kayıtlara konumlanır.
- En üste yaklaşıldığında eski batch yüklenir ve üst tarafa prepend edilir.
- Prepend sonrası kullanıcının baktığı satır aynı ekran konumunda kalır.
- “Daha eski kayıt yok” terminalin en üstünde görünür.
- Her satır timestamp, actor, action, entity, result ve kısa metadata özeti taşır.
- Satır detayları açılabilir; raw JSON ilk görünümde dump edilmez.

## 3. Kapsam

### Kapsam içi

- Cursor bazlı audit query.
- Yukarı yönlü infinite history UI.
- Filter/search ve URL state.
- Terminal görünümü, tarih ayraçları, event severity/result.
- Actor/entity navigasyon linkleri.
- Metadata redaction ve güvenli detail view.
- Yeni spec olaylarının ortak action registry'sine alınması.

### Kapsam dışı

- Audit kayıtlarını silmek/düzenlemek.
- Harici SIEM/export/streaming.
- WebSocket ile canlı tail. V1'de “Yenileri kontrol et” veya sayfa açılışındaki snapshot yeterlidir.
- Uydurma terminal komutu veya shell erişimi.

## 4. Sorgu Kontratı

`listAuditEvents({ before?, limit, filters })`:

- `limit` varsayılan 50, maksimum 100.
- Cursor `(createdAt, id)` birleşimidir; aynı timestamp kayıtları kaybolmaz/tekrarlanmaz.
- Query: cursor'dan daha eski kayıtlar `createdAt DESC, id DESC`, `take=limit+1`.
- Response: `{ events, nextBefore, hasMore }`.
- UI gösterim için batch'i ascending sıraya çevirir; DB sorgusunu offset pagination'a dönüştürmez.
- Select yalnız listede gereken alanlar: id, action, entity, entityId, userId, createdAt, bounded metadata ve actor name/email select'i.
- Metadata büyük olabiliyorsa liste query'si özet üretir; detail server action tek event metadata'sını ayrı alır. AuditLog modelinde ayrı summary alanı gerekmiyorsa JSON payload transferi ölçülür; gerekirse additive `summary`/`severity` alanları migration ile eklenir.

Filtreler:

- `actor=<userId>`
- `entity=<type>`
- `action=<registry-key>`
- `result=success|warning|failure`
- `from`, `to`
- `q` yalnız bounded action/entity/title snapshot üzerinde; raw metadata JSON full scan yapılmaz.

Filtre değişince cursor sıfırlanır ve yeni en son batch açılır.

## 5. Audit Action Registry

Dağınık string yerine `lib/audit/action-registry.ts`:

- key (`content.publish`, `translation.import`, `entity.hard-delete`)
- Türkçe label
- category
- severity/result default
- entity link resolver
- metadata summary formatter
- allowed detail keys/redaction rule

Minimum olay aileleri:

- auth login success/failure/logout
- profile/password/role/user create/deactivate
- content create/draft save/publish/archive/unarchive/hard delete/reorder
- page layout save/publish
- section create/reuse/clone/publish/archive
- translation export/preflight/apply failure/success
- SEO draft save/publish source entity
- media upload/archive/delete/storage failure
- developer mode enable/disable/denied
- site settings/site content save/publish

Action registry geçmiş bilinmeyen key'i kırmaz: `Bilinmeyen olay` + raw key gösterir, detail redaction uygular.

## 6. Terminal UI

### 6.1 Stil

- Dış kart mevcut admin radius/border tokenlarını kullanır.
- İç terminal yüzeyi mevcut invert/dark tokenlardan türetilir; yeni hardcoded palet yoktur.
- Monospace yalnız timestamp/action/meta; uzun açıklamalar admin fontunda kalabilir.
- Satır yapısı:
  - `12:41:08.392`
  - status marker/icon + text
  - actor display name
  - localized action label
  - entity snapshot/link
  - relative duration/metadata chips
- Renk tek anlam taşımaz; ikon/label vardır.
- Tarih değişiminde `8 Eylül 2026` separator.

### 6.2 Scroll davranışı

İlk render:

1. Terminal container mount edilir.
2. Browser paint sonrası `scrollTop = scrollHeight` ile en yeni satıra iner.
3. Bu auto-scroll yalnız ilk yükte ve kullanıcı zaten tabana 80px içindeyken yeni batch eklenirse yapılır.

Eski batch prepend:

1. Top sentinel IntersectionObserver ile görünür.
2. Yükleme öncesi `previousScrollHeight` ve `previousScrollTop` kaydedilir.
3. Eski unique event'ler array başına eklenir.
4. Layout sonrası `scrollTop = newScrollHeight - previousScrollHeight + previousScrollTop`.
5. Strict Mode/double request duplicate'i event ID map engeller.
6. Aynı cursor için eşzamanlı request olmaz.

Keyboard:

- Terminal container focusable.
- PageUp/PageDown normal scroll.
- Home ilk yüklü satıra, End en yeni satıra.
- “En yeniye dön” düğmesi tabandan uzakken görünür.

### 6.3 Filtre ve detay

- Filtreler terminalin üstünde normal admin controls; terminal komutu gibi sahte input yok.
- Satır click/Enter ile accordion detail açar.
- Detay: event ID, kesin ISO timestamp, actor, action key, entity ID/link, allowed metadata key/value.
- Raw JSON yalnız SUPER_ADMIN ve redaction sonrası “Teknik detay” accordion'unda; secret/password/token/cookie/header/request body yok.

## 7. Yeni Olay Bildirimi

WebSocket olmadan:

- Kullanıcı tabandayken “Yenileri kontrol et” 30–60 saniyelik görünür buton veya focus revalidation ile çalışabilir.
- Kullanıcı geçmişteyken yeni batch otomatik prepend/append edip konumu bozmaz; üstte “N yeni olay — en yeniye dön” bildirimi gösterir.
- Polling bütün sayfayı `router.refresh()` ile yenilemez; cursor `after` endpoint/action yalnız yeni olayları getirir.
- Bu davranış opsiyoneldir; yukarı geçmiş yükleme kabul kriterlerini etkilemez.

## 8. Güvenlik

- `/manage/audit` server-side permission ister: ADMIN/SUPER_ADMIN; AUTHOR erişemez.
- Query filter user input Zod ile doğrulanır; arbitrary sort/field yok.
- Actor silinmiş/deaktifse audit snapshot/fallback “Silinmiş kullanıcı” gösterir.
- Metadata formatter allowlist'tir. Keys `password`, `passwordHash`, `token`, `secret`, `cookie`, `authorization`, request body her case varyantında reddedilir.
- Login failure metadata raw email/IP yerine gerekirse normalize/hash taşır; mevcut eski kayıtlar detail'de redaction'dan geçer.
- Audit detail response no-store ve admin route cache sınırındadır.

## 9. Dosya Sahipliği

- `app/manage/(panel)/audit/**`
- `components/admin/AuditPanel.tsx` temiz cutover
- `components/admin/AuditTerminal.tsx` (yeni)
- `lib/audit/action-registry.ts` (yeni)
- `lib/audit/query.ts` (yeni)
- Audit yazan servislerde yalnız registry key migrasyonu
- Gerekli additive audit index/summary migration'ı

Başka speclerde yeni audit event eklenirken action registry sahibiyle seri ilerlenir veya o spec tamamlanınca registry'ye tek entegrasyon commit'i yapılır.

## 10. Kabul Kriterleri

1. **AC-13.1** İlk `/manage/audit` açılışında en yeni event terminalin altında görünür; liste ters kronolojik okunmaz.
2. **AC-13.2** Üste kaydırmak daha eski 50 kaydı prepend eder; kullanıcı viewport'u gözle görünür biçimde sıçramaz.
3. **AC-13.3** Aynı timestamp'e sahip event'ler compound cursor ile kaybolmaz veya duplicate olmaz.
4. **AC-13.4** `hasMore=false` olduğunda tekrar request yapılmaz ve “Daha eski kayıt yok” görünür.
5. **AC-13.5** Filtre URL state'i cursor'u sıfırlar ve yalnız eşleşen sonuçları getirir.
6. **AC-13.6** Satır detail'i keyboard ile açılır ve allowed metadata gösterir; secret/password/token alanı hiçbir response/UI'da görünmez.
7. **AC-13.7** Actor ve entity mevcutsa doğru admin route'una linklenir; silinmişse ekran kırılmaz.
8. **AC-13.8** AUTHOR doğrudan `/manage/audit` veya query action erişiminde engellenir.
9. **AC-13.9** Liste query'si offset kullanmaz, 100'den fazla satır çekmez ve bounded select kullanır.
10. **AC-13.10** Yeni spec olay aileleri registry'de localized label ve safe formatter ile temsil edilir; bilinmeyen eski action ekranı kırmaz.
11. **AC-13.11** 390px'te satırlar taşmadan okunur; terminal yatay sayfa overflow üretmez.

## 11. Test ve Gerçek Doğrulama

### Kalıcı testler

- Compound cursor no gap/no duplicate.
- Prepend scroll-anchor hesabı browser E2E.
- Filter reset.
- Redaction case-insensitive nested metadata.
- Permission.

### Browser senaryosu

1. Test DB'ye farklı timestamp ve aynı timestamp içeren 130 audit event üret.
2. `/manage/audit` aç; en yeni ID'nin altta olduğunu gör.
3. Orta bir satıra konumlanıp top sentinel tetikle; önceki satırın bounding rect farkının ±2px içinde kaldığını doğrula.
4. Üç batch sonrası tüm 130 unique ID'yi gör; ekstra request yok.
5. Filter uygula; URL ve sonuç seti değişsin.
6. Secret benzeri nested metadata fixture'ının redacted olduğunu doğrula.
7. Mobil görünümü ve klavye akışını doğrula; fixture'ı temizle.

### Komutlar

- `npx tsc --noEmit`
- `npx eslint .`
- ilgili integration/E2E testleri
- `npm run build`

## 12. Riskler

- **Scroll sıçraması:** DOM prepend sonrası yükseklik farkı uygulanır; image gibi geç yüklenen içerik audit satırında kullanılmaz.
- **Duplicate requests:** cursor in-flight set + event ID dedupe.
- **JSON transferi:** liste summary/detail ayrımı; raw metadata yalnız seçili event.
- **Secret sızıntısı:** write tarafı sanitize + read tarafı allowlist/redaction defense-in-depth.
- **Sahte terminal:** yalnız görünüm log formatıdır; command execution/input yoktur.

## 13. Definition of Done

- Yukarı kaydırmalı cursor geçmişi, scroll anchoring ve filtreler gerçek tarayıcıda kanıtlanmıştır.
- Audit terminal görünümü mevcut admin tokenlarıyla masaüstü/mobil çalışır.
- Metadata redaction ve permission testleri geçer.
- Typecheck, lint, ilgili testler ve build geçer.
- `ui-context.md`, `architecture.md` ve `progress-tracker.md` gerçek duruma göre güncellenir.
