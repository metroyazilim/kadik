# Progress Tracker

## Tamamlandı
- [x] Starter base audit ve bağımsız Kadık checkout.
- [x] Referans sayfaların 1440×900 / 390×844 capture'ı.
- [x] Public shell ve verilen Türkçe rotalar.
- [x] Yazılar kategori filtresi/dropdown, mobil menü, galeri lightbox, form API.
- [x] Hono health/content endpoint.
- [x] TypeScript ve production build.

## Blocked / sonraki adım
- [ ] Docker daemon çalışmadığı için PostgreSQL başlatılamadı; form DB kalıcılığı doğrulanamadı.
- [ ] Events, Issues, Gallery için admin CRUD ve gerçek Prisma entity'leri sonraki vertical slice.
- [ ] Referans dış görselleri R2/local media library'ye import et.

## Son kanıt
- `npm run build` exit 0.
- Local route sweep 11/11 başarılı.
- `GET /api/kadik-api/health` HTTP 200.
