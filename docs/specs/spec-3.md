# Spec 3 — Üçüncü Parti CDN Bağımlılığını Kaldırma ve Asset Optimizasyonu

**Durum:** Bekliyor
**Kanonik Depo:** `/Users/berat/extech`
**Sahiplenilen Dosyalar:** `public/assets/**`, `components/Footer.tsx`, `components/OfferItem.tsx`, `components/PageBanner.tsx`, `components/SectionHeading.tsx`, `components/TestimonialCard.tsx`, `lib/public-pages/about.tsx`, `lib/public-pages/blog-list.tsx`, `lib/public-pages/mission-vision.tsx`, `app/[locale]/**/page.tsx` (yalnızca servis ikonları referansları)
**Paralellik:** Spec 2 ile tamamen paralel çalışabilir. Spec 5 ile ortak bileşen paylaştığı için Spec 5'ten önce tamamlanmalıdır.

---

## 1. Hedef ve Görünür Sonuç
Sitedeki tüm dış `https://wpriverthemes.com/...` ve harici CDN bağımlılıklarının sıfırlanması; tüm maske, SVG ikon, banner arka planları ve sabit şablon görsellerinin yerel `public/assets/` klasörüne çekilerek yerel yollardan sunulması. Dış sunucu kapansa dahi sitenin %100 eksiksiz ve hızlı açılması.

---

## 2. Kapsam İçi ve Kapsam Dışı

### Kapsam İçi:
- `components/Footer.tsx`, `components/PageBanner.tsx`, `components/SectionHeading.tsx`, `components/TestimonialCard.tsx` içindeki sabit `IMG` ve `ICON` URL'lerinin `/assets/...` yerel yollarına çekilmesi.
- `lib/public-pages/about.tsx`, `blog-list.tsx`, `mission-vision.tsx` içindeki harici banner ve maske görsellerinin yerel depoya indirilmesi.
- Dil bazlı hizmet listesi sayfalarında (`servisler`, `services`, `услуги`, `الخدمات`) kullanılan `s-icon-1.svg` harici bağlantısının yerelleştirilmesi.
- Gerekli tüm SVG ve WebP/PNG varlıklarının `public/assets/img/` hiyerarşisinde toplanması.

### Kapsam Dışı:
- `MediaAsset` (kullanıcının Cloudflare R2'ye yüklediği dinamik görseller) mantığına dokunmak.
- Header navigasyon veya sözlük metinlerini değiştirmek (Spec 5'in konusu).
- Veritabanı ve sunucu kodlarında değişiklik yapmak.

---

## 3. Kabul Kriterleri (Acceptance Criteria)
- **AC-3.1:** Kod tabanında `components/` ve `lib/public-pages/` altında hiçbir harici `wpriverthemes.com` bağlantısı kalmaz (`grep -rn "wpriverthemes" components lib/public-pages` 0 sonuç döner).
- **AC-3.2:** Ana sayfa, Hakkımızda, Hizmetler, Blog Listesi ve İletişim sayfaları açıldığında DevTools Network sekmesinde hiçbir harici domain'e görsel/ikon isteği atılmaz.
- **AC-3.3:** Sayfa banner'ları (`PageBanner`), alt bilgi (`Footer`) ve bölüm başlıkları (`SectionHeading`) yerel SVG/PNG maskeleriyle görsel bozulma olmadan render edilir.

---

## 4. Doğrulama ve Test Adımları
- `grep` taraması ile harici URL kalmadığı teyit edilir.
- `npx tsc --noEmit` ve `npm run build` hatasız tamamlanır.
- E2E testi ile sayfaların görsel asset'lerinin 200 OK döndüğü doğrulanır.
