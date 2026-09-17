# Kadık — Proje Özeti

## Hedef
KADİK (Kybele Atasever Dünya İş Konseyi) için Türkçe, iş dünyası odaklı kurumsal public site: referans sayfaların görsel ritmini ve etkileşimlerini korurken içerik, form ve yönetim altyapısını Metro starter üzerinde sürdürmek. Kurul üyeleri ve yayınlar veritabanından, görseller Cloudflare R2 medya kitaplığından gelir.

## Public kapsam
`/`, `/hakkimizda`, `/kurul-uyeleri`, `/etkinlikler`, `/uyelik` (üyelik başvurusu; eski `/gonulluluk` kalıcı yönlenir), `/duyurular`, `/yazilar`, `/yazilar/<slug>`, `/iletisim`, `/galeri`, `/gizlilik-politikasi`, `/kullanim-sartlari`, global 404.

## Başarı ölçütü
1440×900 ve 390×844 capture ölçülerinde ortak header/banner/footer, mobil menü, yazı filtresi, galeri lightbox, form API ve Hono health endpoint çalışır. Ana sayfa kurul üyelerini ve yayınları yayınlanmış revizyonlardan okur; üyelik başvurusu `Message` kaydına düşer.

## Tercihler
PREF-001, PREF-002, PREF-003, PREF-004, PREF-005 uygulanmıştır. Sayfa başlıklarında kullanıcı talimatı gereği `| KADIK` ayracı kullanılır.
