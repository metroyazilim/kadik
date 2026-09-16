# Güvenlik Sözleşmesi

Form payload'ı sunucuda doğrulanır, e-posta normalize edilir ve Prisma'ya yazılır. Secret'lar `.env` üzerinden gelir. Hono API salt read-only discovery'dir. Kullanıcı girdisi HTML olarak render edilmez. Rate-limit/idempotency için starter `Message` sözleşmesi ve `submissionHash` korunur.
