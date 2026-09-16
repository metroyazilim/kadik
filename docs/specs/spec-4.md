# Spec 4 — Arşivlenmiş Taslak: Legacy Dil Tabloları

**Durum:** Uygulanmayacak — güncel disk envanteri hedeflenen koleksiyon locale modellerinin zaten bulunmadığını gösterir; kalan page/section cutover Spec 8, external import geçmişi Spec 16 kapsamındadır.  
**Yerine geçen belgeler:** `docs/specs/spec-8.md`, `docs/specs/spec-16.md`  
**Kanonik Depo:** `/Users/berat/extech`

---

## 1. Hedef ve Görünür Sonuç
Projenin ilk döneminden kalan dil başına ayrı tabloların (`PostTr/En/Ru/Ar`, `ServiceTr/En/Ru/Ar`, `ProductTr/En`, `ProjectTr/En`, `TeamMemberTr/En`, `FaqTr/En` vb.) ve `MigrationDomainRegistry` geçiş katmanının veritabanından tamamen silinmesi. Sistemin %100 oranında modern, tekil `ContentEntity` / `ContentTranslation` / `ContentTranslationRevision` mimarisine oturması.

---

## 2. Kapsam İçi ve Kapsam Dışı

### Kapsam İçi:
- `prisma/schema.prisma` içinden tüm eski `*Tr`, `*En`, `*Ru`, `*Ar` modellerinin ve `MigrationDomainRegistry` tablosunun kaldırılması.
- Yeni bir temiz Prisma migration üretilmesi (`prisma migrate dev`).
- `scripts/` altındaki tek seferlik `migrate-*.ts` aktarım scriptlerinin ve `retire-migration-domain.ts` scriptinin tamamlanması/temizlenmesi.
- `lib/migration/` altındaki eski backfill kodlarının silinmesi veya emekliye ayrılması.
- Eski tablolara doğrudan SQL/Prisma sorgusu atan testlerin güncellenmesi.

### Kapsam Dışı:
- `ContentEntity` içerik modelinin yapısını değiştirmek (kimlik, çeviri, taslak/yayın mantığı aynen korunur).
- Yönetim paneli arayüzü veya public sayfa tasarımları.

---

## 3. Kabul Kriterleri (Acceptance Criteria)
- **AC-4.1:** `prisma/schema.prisma` içinde hiçbir legacy dil tablosu kalmaz; `npx prisma validate` temiz geçer.
- **AC-4.2:** Veritabanında tüm hizmetler, blog yazıları, projeler, ürünler, ekip üyeleri ve SSS kayıtları kayıpsız olarak `ContentEntity` üzerinden okunmaya devam eder.
- **AC-4.3:** Eski migration tablolarına referans veren TypeScript hataları tamamen çözülür; `npx tsc --noEmit` 0 hata verir.
- **AC-4.4:** Tüm public liste ve detay sayfaları (`/hizmetler`, `/blog`, `/projeler` vb.) hatasız olarak verileri sunmaya devam eder.

---

## 4. Doğrulama ve Test Adımları
- `npx prisma migrate dev` başarıyla tamamlanır.
- `npx tsc --noEmit` ve `npm run build` temiz geçer.
- Mevcut E2E test seti (`npm run test:e2e`) çalıştırılarak veri kaybı veya kırılma olmadığı kanıtlanır.
