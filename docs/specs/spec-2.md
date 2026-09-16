# Spec 2 — Üretime Hazırlık, Güvenlik Başlıkları ve Hata Yüzeyleri

**Durum:** Bekliyor
**Kanonik Depo:** `/Users/berat/extech`
**Sahiplenilen Dosyalar:** `lib/env.ts`, `next.config.ts`, `proxy.ts`, `app/error.tsx`, `app/not-found.tsx`, `components/admin/DatabaseNotConfigured.tsx`, `lib/dev-tools/**`, `tests/e2e/spec-2-prod-readiness.spec.ts`
**Paralellik:** Spec 3 ile tamamen paralel çalışabilir (dosya çakışması yoktur).

---

## 1. Hedef ve Görünür Sonuç
Uygulamanın prod ortamına güvenle çıkmasını sağlamak. Eksik environment durumunda çökmek yerine zarif ekranlar sunulması, tüm HTTP yanıtlarında katı güvenlik başlıklarının (CSP, HSTS, X-Frame-Options) bulunması ve 404/500 sayfalarının genel marka görsel diline uygun hale getirilmesi.

---

## 2. Kapsam İçi ve Kapsam Dışı

### Kapsam İçi:
- `lib/env.ts` içine katı Zod şeması ve doğrulaması (`DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `R2_*`).
- `next.config.ts` içinde Security Headers konfigürasyonu (Content-Security-Policy, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- Public siteye uygun `app/not-found.tsx` (404) ve `app/error.tsx` (500) hata ekranları.
- Veritabanı bağlantısı yokken yönetim panelinde gösterilen `DatabaseNotConfigured` uyarısının wpfuk token setine uyarlanması.
- Geliştirici ortamı test araçlarının (`lib/dev-tools`) prod ortamında tamamen engellenmesi.

### Kapsam Dışı:
- Veritabanı şemasında (`prisma/schema.prisma`) değişiklik yapmak.
- Harici görsel veya CDN asset'lerine dokunmak (Spec 3'ün konusu).
- Blog veya içerik yönetim akışlarını değiştirmek.

---

## 3. Kabul Kriterleri (Acceptance Criteria)
- **AC-2.1:** `.env` içinde `DATABASE_URL` veya `AUTH_SECRET` eksik/hatalı olduğunda uygulama patlamaz, loglara anlaşılır hata basar ve `lib/env.ts` hatayı yakalar.
- **AC-2.2:** `curl -I http://localhost:3000` çıktısında `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` ve temel CSP başlıkları döner.
- **AC-2.3:** Olmayan bir URL'e (`/olmayan-sayfa`) gidildiğinde ham Next.js 404 ekranı değil, sitenin Header/Footer'ını içeren şık `not-found.tsx` render edilir.
- **AC-2.4:** Beklenmeyen bir sunucu hatasında kullanıcıya teknik stack trace yerine dostane bir `error.tsx` ekranı ve "Tekrar Dene" butonu sunulur.
- **AC-2.5:** `NODE_ENV=production` iken `/api/dev-tools/*` uçları 403 Forbidden döner.

---

## 4. Doğrulama ve Test Adımları
- `npx tsc --noEmit` ve `npx eslint .` hatasız geçmelidir.
- `tests/e2e/spec-2-prod-readiness.spec.ts` yazılarak HTTP başlıkları ve 404 sayfası doğrulanmalıdır.
