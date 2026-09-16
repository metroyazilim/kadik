# Mimari

Next.js App Router public frontend + mevcut Metro admin + Prisma/PostgreSQL service/data katmanı. Kadık public shell client component içinde mobil ve küçük etkileşimleri yönetir; form istekleri `/api/kadik/contact` üzerinden ortak Prisma `Message` modeline gider. Hono uygulaması `/api/kadik-api/*` altında sağlık ve içerik discovery uçları sağlar.

DB bağlantısı yokken public sayfalar içerik fallback'iyle çalışır; form kalıcılığı `503` ile açıkça başarısız olur, sessiz mock kayıt yapılmaz.
