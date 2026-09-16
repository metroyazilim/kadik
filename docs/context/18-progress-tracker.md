# Progress Tracker

## Tamamlandı
- [x] Starter base audit ve bağımsız Kadık checkout.
- [x] Referans sayfaların 1440×900 / 390×844 capture'ı.
- [x] Public shell ve verilen Türkçe rotalar.
- [x] Yazılar kategori filtresi/dropdown, mobil menü, galeri lightbox, form API.
- [x] Hono health/content endpoint.
- [x] KADIK markalı admin shell ve `/manage/login` → `/manage` akışı.
- [x] Projeye özel yerel PostgreSQL cluster (55432), 18 migration ve idempotent seed.
- [x] İletişim API'sinin Message tablosuna yazdığı uçtan uca doğrulandı.
- [x] Referans görselleri `public/kadik` altında yerelleştirildi; favicon eklendi.
- [x] TypeScript ve production build.

## Bilinen kapsam / sonraki adım
- [ ] Docker daemon kapalı; bunun yerine `.local/postgres` altında izole Homebrew PostgreSQL kullanılıyor.
- [ ] Events, Issues, Gallery için admin CRUD ve gerçek Prisma entity'leri sonraki vertical slice.
- [ ] Public Kadık rotaları şu an bağımsız içerik kabuğundaki statik örnek verileri kullanıyor; bunların admin registry'lerine bağlanması sonraki CMS adımı.
- [ ] `npm run lint` 0 hata ile tamamlanıyor; starter'dan devralınan `<img>` ve `<a>` kullanımları nedeniyle 140 warning var.

## Son kanıt
- `npm run build` exit 0.
- `npx tsc --noEmit` exit 0.
- `npm run lint` exit 0 (0 error, 140 warning).
- Local route sweep 11/11 başarılı.
- `GET /api/kadik-api/health` HTTP 200.
- `GET /api/kadik-api/content` HTTP 200.
- `POST /api/kadik/contact` HTTP 200; `Message` satırı doğrulandı.
- Local admin login HTTP 200; `/manage` dashboard erişimi doğrulandı.
