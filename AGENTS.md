# Extech — Agent Entry Point

## Application Building Context

Uygulama yapmadan veya herhangi bir mimari karar almadan önce şu dosyaları bu sırayla oku:

1. `docs/context/project-overview.md` — ürün tanımı, hedefler, özellikler, kapsam
2. `docs/context/architecture.md` — sistem yapısı, sınırlar, depolama modeli, değişmezler
3. `docs/context/ui-context.md` — tema, renk token'ları, tipografi, bileşen konvansiyonları
4. `docs/context/code-standards.md` — uygulama kuralları ve konvansiyonlar
5. `docs/context/ai-workflow-rules.md` — geliştirme akışı, kapsam kuralları, teslim yaklaşımı
6. `docs/context/progress-tracker.md` — mevcut faz, tamamlanan iş, açık sorular, sıradaki adımlar

Ardından güncel `git status`, ilgili kaynak kodu, testleri, `prisma/schema.prisma` ve kurulu paketleri incele. Önceki ajanların raporları ipucudur, otorite değildir; disk durumu ve çalıştırılabilir davranış otoritedir.

Her anlamlı uygulama değişikliğinden sonra `docs/context/progress-tracker.md`'yi güncelle. Uygulama mimariyi, kapsamı veya standartları değiştiriyorsa devam etmeden önce ilgili bağlam dosyasını güncelle.

## Komut: `<ad> oluştur`

Spesifikasyon yazarı olarak davran.

- Dosyayı tam istenen adla oluştur: `docs/specs/<istenen-ad>.md`.
- Yalnızca o spec'i ve gerektiğinde `docs/context/progress-tracker.md`'deki mevcut durum kaydını yaz.
- Uygulama kodu yazma, paket kurma, migration üretme.
- Yazmadan önce mevcut uygulamayı incele; neyin yeniden kullanılacağını, neyin gerçekten eksik olduğunu ve hangi yönetim/public akışının tamamlanmayı kanıtladığını belirle.
- Sıradan teknik kararları spec içinde çöz. Yalnızca ürün davranışını maddi olarak değiştiren seçimleri "Açık Sorular" altında bırak.

Her spec şunları içerir:

1. Hedef ve görünür sonuç
2. Doğrulanmış mevcut davranış
3. Kapsam içi / kapsam dışı
4. Korunacak ve yeniden kullanılacak mevcut dosya/bileşen/paketler
5. Yönetim ve public kullanıcı akışları
6. UI/bileşen davranışı ve kullanılacak token'lar
7. Sunucu/uygulama/veri akışı
8. Şema, migration ve uyumluluk planı
9. Route, dil, fallback ve SEO davranışı
10. Güvenlik ve erişilebilirlik gereksinimleri
11. Numaralanmış, ölçülebilir kabul kriterleri
12. Kabul kriteri → test eşlemesi
13. Uygulama sırası
14. Riskler, geri alma ve koruma kuralları
15. Definition of Done

Spec dikey bir sonuç tanımlar. Public tüketicisi olmayan bir veri modeli veya yönetim formu tamamlanmış özellik değildir.

## Komut: `<ad> uygula`

Uygulama sahibi olarak davran. Adı verilen spec'i oku ve rutin onay duraklarına uğramadan tamamla.

1. Spec'in var olduğunu doğrula; yoksa dur ve eksik yolu bildir.
2. Altı bağlam dosyasını ve güncel kaynak/Git durumunu yeniden oku.
3. Spec ile mevcut uygulamayı karşılaştır. Çalışan davranışı koru, mevcut bileşenleri yeniden kullan.
4. Dikey akışın tamamını uygula: UI → sunucu sınırı → uygulama/veri katmanı → kalıcılık → public sonuç.
5. Her kabul kriteri için testleri ekle veya güncelle.
6. Doğrulama setini çalıştır: `npx tsc --noEmit`, `npx eslint .`, ilgili testler, `npm run build`.
7. Gerçek akışı `http://localhost:3000` üzerinde tarayıcıda çalıştır; kullanılan dizin, branch ve SHA'yı bildir.
8. Bitmiş diff'i doğruluk, güvenlik, erişilebilirlik, veri bütünlüğü ve spec'e uygunluk açısından gözden geçir; High/Medium bulguları aynı turda düzelt.
9. `docs/context/progress-tracker.md`'yi ve spec'in durum/kanıt bölümünü güncelle.
10. Kullanıcı aksini söylemedikçe odaklı bir yerel commit oluştur. Açıkça istenmedikçe push etme.

Planlama, iskele, kısmi backend, geçen bir build veya üretilmiş bir rapordan sonra durma. Spec'in görünür Definition of Done'ı sağlanana veya gerçek bir harici/ürün engeli çıkana kadar devam et.

## Non-Negotiable Project Rules

- Kanonik dizin: `/Users/berat/extech`. Tek fiziksel checkout; kullanıcı açıkça istemedikçe worktree oluşturma.
- Aynı checkout'ta birden fazla yazan ajan çalışmaz. Salt okunur inceleme paralel olabilir.
- Her yönetim ekranı kendi route'udur. Rutin liste/oluşturma/düzenleme/sıralama akışları drawer veya modal içinde yaşamaz.
- Yönetim panelinin görsel dili `docs/context/ui-context.md` token setinden gelir; ham hex yazılmaz. Public site kendi mevcut görsel dilini korur.
- Zengin metin için bakımlı bir paket (Tiptap) kullanılır; elle yazılmış toolbar/`contentEditable` editör yasaktır.
- Sıralama dnd-kit pointer ve klavye sensörleriyle yapılır; sayısal sıra girişi istenmez.
- Görseller `MediaAsset`/Cloudflare R2 akışından gelir; serbest dış görsel URL alanı eklenmez.
- Public sayfalar yalnızca yayınlanmış revizyonu okur; taslak asla sızmaz.
- Bir yönetim alanı, yayınlama ilgili public yüzeyi değiştirmedikçe tamamlanmış sayılmaz.
- Türkçe varsayılan ve öneksizdir; Türkçe route'lar Türkçe segment kullanır (`/hakkimizda`). `/tr/*` ve Türkçe `/about` legacy yönlendirmedir.
- Liste sorguları sayfalanır ve yalnızca gösterilen alanları seçer.
- BMAD araçları veya çıktıları kullanılmaz; depodan kaldırılmıştır.
- Next.js davranışını değiştirmeden önce `node_modules/next/dist/docs/` altındaki kurulu dokümantasyonu oku; sürüm genel model bilgisinden yenidir.
- `.env` başka bir depoya kopyalanmaz ve commit edilmez.
- İlgisiz kullanıcı değişiklikleri korunur; sessizce reset/clean yapılmaz.
