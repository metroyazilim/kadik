# KADIK yerel çalıştırma

Proje: `/Users/berat/anton/kadik`. Çalıştırma: bu klasörde `npm run dev` (varsayılan port 3901). Site `http://localhost:3901`, admin `http://localhost:3901/manage/login`.

Başlangıç `.env.local` dosyasını Next ile aynı yükleyici üzerinden okur. Şifre/secret Git'e yazılmaz; admin email/password bu yerel dosyadadır. Mevcut admin hesabını yeniden seed etmeden doğrular. Şifreyi değiştirmek için panelde Kullanıcılar ekranını kullanın; `db:seed` mevcut bootstrap şifresini sıfırlar, rutin başlatmada kullanılmaz.

Yerel PostgreSQL veri klasörü `.local/postgres`, port 55432, DB `kadik`. `npm run db:up` yalnız readiness/start işlemini yapar. `npm run dev` önce bunu yapar, ardından 15 saniyede bir servis durumunu kontrol eder. DB kapanırsa aynı cluster açılır, veriler ve hesaplar korunur. Next kapatıldığında PostgreSQL açık kalabilir. Veri klasörü yoksa otomatik yeni/boş cluster oluşturarak veri kaybını gizlemez; komut açıklayıcı hata verir.

Manuel kontrollü DB durdurma: `/opt/homebrew/bin/pg_ctl -D /Users/berat/anton/kadik/.local/postgres -m fast -w stop`. Dev açıkken supervisor tekrar açar. Tam kapatma için önce dev terminalinde Ctrl+C kullanın. Bu komut başka PostgreSQL servislerini etkilemez.

Canlılık: `/api/kadik-api/health`. Gerçek DB hazır kontrolü: `/api/kadik-api/ready` (200/503).

Test: `npx playwright test --config=playwright.kadik.config.ts` (kurulu Chrome, 3901 açıkken). Rapor `test-results/kadik/report/index.html`; masaüstü/mobil screenshot'lar `test-results/kadik/artifacts`.

Kesinti testi: `node scripts/verify-local-recovery.mjs` (yalnız geliştirmede, KADIK DB'sini kısa süre durdurur, supervisor toparlanmasını/admin girişini doğrular ve finally tekrar açar). Build'i dev ile aynı anda çalıştırmayın; `npm run build` sonrası `npm run dev` ile yeniden başlatın.

React DevTools önerisi ve `[HMR] connected` bilgi mesajıdır. `content.js ... tabs:outgoing.message.ready` temiz Chrome testinde görülmedi ve uygulama kaynaklarında bulunmadı; uygulama dışındaki bir tarayıcı uzantısı/entegrasyonu olası kaynaktır. Kaynak tespiti için kendi tarayıcınızda uzantısız profil ile karşılaştırın.
