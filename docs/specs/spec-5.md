# Spec 5 — Public Shell (Header, Footer, Banner) ve Sabit Sözlüklerin CMS'e Bağlanması

**Durum:** Bekliyor
**Kanonik Depo:** `/Users/berat/extech`
**Sahiplenilen Dosyalar:** `lib/content.ts`, `lib/i18n/dictionaries/**`, `lib/public-content/site-shell-view.ts`, `components/SiteHeader.tsx`, `components/Footer.tsx`, `components/MobileMenu.tsx`, `components/LanguageSwitcher.tsx`, `components/PageBanner.tsx`, `app/manage/(panel)/site-content/**`, `app/manage/(panel)/site-settings/**`
**Paralellik:** Spec 3 (CDN Asset) tamamlandıktan sonra seri olarak yürütülmelidir (`Footer.tsx` ve ortak bileşen paylaştıkları için çakışma önlenir).

---

## 1. Hedef ve Görünür Sonuç
Sitedeki sabit kodlanmış (hardcoded) veya yerel dosya sözlüklerinde (`tr.ts`, `en.ts`, `ru.ts`, `ar.ts`) hapsolmuş navigasyon linkleri, sosyal medya bağlantıları, logo/marka metinleri, footer telif yazıları ve sayfa banner başlıklarının tamamen Admin Panel'deki **Site Ayarları (`/manage/site-settings`)** ve **Site İçeriği (`/manage/site-content`)** üzerinden dinamik olarak yönetilebilir hale getirilmesi.

---

## 2. Kapsam İçi ve Kapsam Dışı

### Kapsam İçi:
- `components/SiteHeader.tsx` ve `components/Footer.tsx` bileşenlerinin `lib/public-content/site-shell-view.ts` üzerinden yayınlanmış `site-settings` verilerini öncelikli olarak kullanması (veritabanında varsa o kullanılır, yoksa sözlük fallback'ine düşülür).
- Footer içindeki sosyal medya linkleri, bülten metni ve hızlı linklerin admin panelden güncellenebilmesi.
- `PageBanner.tsx` içindeki sayfa başlık ve yönlendirme etiketlerinin dinamikleştirilmesi.
- Admin paneldeki `/manage/site-content` ekranında eksik kalan statik sayfa sözlük alanlarının (Hakkımızda, İletişim, Misyon/Vizyon) düzenlenebilmesi.

### Kapsam Dışı:
- Hizmet, proje, ürün veya blogların kendi içerik/detay yapıları (onlar zaten kendi editörlerinde yönetiliyor).
- Görsellerin yerel depoya indirilmesi (Spec 3'te tamamlanmış olur).

---

## 3. Kabul Kriterleri (Acceptance Criteria)
- **AC-5.1:** Yönetim panelinden (`/manage/site-settings`) header logosu, marka adı veya menü sırası değiştirilip yayınlandığında public sitenin tüm sayfalarında (tüm dillerde) anında güncellenir.
- **AC-5.2:** Footer sosyal medya hesapları (LinkedIn, Twitter, Facebook vb.) ve telif metni admin panelden yönetilebilir.
- **AC-5.3:** Veritabanında bir ayar henüz yapılmamışsa site kırılmaz; `lib/i18n/dictionaries/` içindeki varsayılan sözlük değerleri zarif bir fallback olarak devreye girer.

---

## 4. Doğrulama ve Test Adımları
- Admin panelden bir menü öğesi ve footer metni değiştirilip kaydedilir/yayınlanır.
- Tarayıcıda public sayfa yenilenerek değişikliğin yansıdığı doğrulanır.
- `npx tsc --noEmit` ve `npm run build` hatasız geçer.
