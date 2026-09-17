# KADIK yerel çalışma ve scroll motion düzeltmesi

Kapsam: 3901 portunda güvenilir yerel başlangıç, mevcut PostgreSQL verisini koruyarak otomatik başlatma, admin giriş hatalarının anlaşılır sunumu, DB'den bağımsız 404, eksik root layout'lar, public scroll reveal ve görünür etkileşim hataları.

Kanıt: `.local/postgres/server.log` 03:14 smart shutdown; `pg_ctl status` kapalı. `npm run dev` yalnız Next başlatıyor. Yeni public segmentlerin layout dosyası yok. ContactForm await sonrasında event.currentTarget kullanıyor; query kategori bağlantıları filtreyi uygulamıyor.

Uygulanan kullanıcı tercihleri: PREF-001 mevcut auth/DB'yi koru; PREF-003 küçük doğrulanabilir işler; PREF-004 rutin onay durakları yok; bu talimatla kaydedilen PREF-006 scroll motion ve PREF-007 hata toparlama/tüm sayfa doğrulaması.

Mevcut auth/Prisma/seed korunur. Migration ve şifre sıfırlama yok. Başlangıç mevcut DATABASE_URL'in yalnız proje-local 127.0.0.1:55432/kadik eşleşmesinde pg_ctl kullanır; başka DB'leri yönetmez. Başka sürece ait portu öldürmez. DB açılmazsa dev komutu açık hatayla biter. Yeniden başlangıç veriyi/hesabı değiştirmez.

Motion: public içerikte tek IntersectionObserver; fade-up, küçük image-scale ve kart gruplarında sınırlı stagger; ilk ekran/LCP görünür; reduced-motion ve JS kapalı durumda içerik görünür; klavye odağı gizlenmez; admin hareketlendirilmez. CSS transform/opacity, cleanup, bir kez tetiklenme.

Kabul: public 12 adres masaüstü/mobilde render ve asset/console/hydration kontrolü; admin login ve tüm nav ekranları; form → API → Message → admin; kategori, galeri ve takvim kontrolü; scroll öncesi/sonrası ve reduced-motion testi; DB durdur/başlat sonrası tekrar login; tsc/lint/build. Test çıktısı docs/context/kadik-verification.md; screenshot'lar test-results/kadik altında.
