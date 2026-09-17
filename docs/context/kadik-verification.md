# KADIK doğrulama kaydı

Son doğrulama: 2026-09-17.

- Lokal site: `http://localhost:3901`
- Admin: `http://localhost:3901/manage/login`
- Admin kullanıcı ve şifre: proje kökündeki `.env.local` içindeki `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- DB: proje içi PostgreSQL, `127.0.0.1:55432`, veritabanı `kadik`

## Uygulanan son navbar değişikliği

Üst menü artık Anasayfa, Hakkımızda, Hizmetler, Yazılar, Galeri ve İletişim bağlantılarını gösteriyor. `Hizmetler` alt menüsünde Etkinlikler, Gönüllülük ve Duyurular var; header'daki ayrı `Katıl` butonu kaldırıldı. Masaüstü hover ve mobil açılır menü senaryoları test dosyasına eklendi.

## Çalıştırılan kontroller

- `GET /api/kadik-api/ready` → HTTP 200, `database: ready`
- `npx playwright test --config=playwright.kadik.config.ts` → 40/40 geçti (desktop + mobile)
- `node scripts/verify-local-recovery.mjs` → DB kapanınca readiness 503 ve anlaşılır login hatası; ardından DB otomatik açıldı ve admin dashboard login'i başarılı
- `npx tsc --noEmit --incremental false` → başarılı
- `npx eslint . --format json` → 0 hata, 29 warning
- `npm run build` → başarılı; 35 statik sayfa üretildi

## Çalıştırma

`npm run dev -- --port 3901` komutu `scripts/dev.mjs` supervisor'ını çalıştırır. Supervisor önce `.local/postgres` cluster'ını hazırlar, sonra Next.js'i başlatır ve DB'yi 15 saniyelik aralıklarla izler. Build sırasında dev süreci kapatılmalı, build bitince tekrar başlatılmalıdır.
