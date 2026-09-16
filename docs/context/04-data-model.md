# Veri Modeli

Mevcut `Message` modeli iletişim/gönüllülük başvurularını `locale`, `name`, `email`, `phone`, `subject`, `message`, `submissionHash`, `status` alanlarıyla alır. `submissionHash` 10 dakikalık idempotency bucket'ı ile çift gönderimi engeller. Etkinlik, yazı ve galeri için ilk public dilim seed-backed UI verisi kullanır; kalıcı CMS dikey dilimi sonraki spec'tir.

Invariant: yayınlanmamış içerik public'e sızmaz; mesaj silme yerine starter'ın arşiv akışı kullanılır.
