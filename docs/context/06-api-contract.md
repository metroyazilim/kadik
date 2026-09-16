# API Sözleşmesi

## `POST /api/kadik/contact`

Payload: `{ name, email, phone?, subject?, message, kind? }`. `name`, geçerli `email` ve `message` zorunludur. Başarıda `{ ok: true }`, hatalı payload `400`, DB yok/kayıt hatası `503` döner.

## `GET /api/kadik-api/health`

Hono endpoint'i `{ ok: true, service: "kadik-api", version: "1" }` döner.

## `GET /api/kadik-api/content`

Türkçe public route discovery döner; içerik mutasyonu yapmaz.
