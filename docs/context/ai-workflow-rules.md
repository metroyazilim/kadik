# AI Workflow Rules

## Approach

Bu proje spec güdümlü geliştirilir. Büyük/yüksek akıl yürütmeli bir model `docs/specs/<ad>.md` altında bir spec yazar; uygulayan model o spec'i birebir hayata geçirir. Bağlam dosyaları neyin inşa edileceğini, nasıl inşa edileceğini ve mevcut durumu tanımlar. Spec'te yazmayan davranış uydurulmaz.

Zorunlu okuma sırası (her oturum başında):

1. `docs/context/project-overview.md`
2. `docs/context/architecture.md`
3. `docs/context/ui-context.md`
4. `docs/context/code-standards.md`
5. `docs/context/ai-workflow-rules.md`
6. `docs/context/progress-tracker.md`
7. İlgili kaynak kod, testler, `prisma/schema.prisma` ve güncel `git diff`

Geçmiş rapor ve ajan çıktıları ipucudur, otorite değildir. Disk durumu, çalışan testler ve tarayıcı davranışı otoritedir.

## Scoping Rules

- Tek fiziksel checkout içinde bir seferde bir özellik birimi uygulanır.
- Paralel terminal çalışması yalnızca her spec kendi Git worktree'inde veya temiz kopyasında çalışıyorsa yapılır; aynı `/Users/berat/extech` checkout'una iki terminal aynı anda yazmaz.
- Küçük ve doğrulanabilir artışlar, büyük spekülatif değişikliklere tercih edilir.
- İlgisiz sistem sınırları tek uygulama adımında birleştirilmez.
- Bir birim, bir görünür uçtan uca sonuç üretir. Public tüketicisi olmayan veri modeli tamamlanmış birim değildir.

## When to Split Work

Bir adım şu ikilileri birleştiriyorsa bölünür:

- Yönetim arayüzü değişikliği + şema/migration değişikliği
- Birbirinden bağımsız iki içerik alanının (örn. medya kütüphanesi ve SEO denetimi) route'ları
- Bağlam dosyalarında net tanımlanmamış davranış + tanımlı davranış

Bir değişiklik uçtan uca hızlıca doğrulanamıyorsa kapsam çok geniştir; bölünür.

## Parallel Terminal Rules

Paralel çalıştırılabilecek spec, dosya sahipliği çakışmayan spec'tir. Çakışma kararında niyet değil gerçek dosya yolu esas alınır.

- Her terminal **aynı ana checkout (`/Users/berat/extech`) üzerinde**, farklı spec klasörlerine odaklanarak ve ortak dosyalara aynı anda yazmadan çalışır (Git worktree zorunlu değildir).
- Ortak başlangıç SHA'sı yazılır. Her spec kendi branch'inde veya dosya alt kümesinde biter; aynı dosyaya aynı anda iki terminal dokunmaz.
- Aynı dosyaya dokunması gereken iki spec seri ilerler; önce biri biter, sonra diğeri başlar.
- Global/shared dosyalar (`prisma/schema.prisma`, `lib/content.ts`, `lib/i18n/**`, `next.config.ts`, `app/globals.css`, `components/SiteHeader.tsx`, `components/Footer.tsx`) aynı anda tek spec sahibine verilir.
- Paralel spec'ler `docs/context/progress-tracker.md` içindeki "Parallelizable Backlog" bölümünde tanımlanır.

## Handling Missing Requirements

- Bağlam dosyalarında tanımlı olmayan ürün davranışı uydurulmaz.
- Bir gereksinim belirsizse önce ilgili bağlam dosyasında netleştirilir, sonra uygulanır.
- Bir gereksinim eksikse `progress-tracker.md`'nin "Open Questions" bölümüne yazılır ve devam edilir.
- Yalnızca şu üç durumda kullanıcıya sorulur: ürün davranışını maddi olarak değiştiren karar, gerçek bir secret/harici hesap ihtiyacı, üretim veya yıkıcı veri etkisi.

## Protected Files

Açık talimat olmadan değiştirilmez:

- `node_modules/` altındaki üçüncü parti içerikler
- Uygulanmış Prisma migration dosyaları (`prisma/migrations/**`)
- `.env` ve secret değerleri
- Public görsel dil (public bileşenlerin mevcut token ve düzeni) — UI spec'i olmadan
- `prisma/schema.prisma` — spec'in şema bölümü olmadan

## Keeping Docs in Sync

Uygulama şunlardan birini değiştirdiğinde ilgili bağlam dosyası aynı turda güncellenir:

- Sistem mimarisi veya sınırlar → `architecture.md`
- Depolama modeli kararları → `architecture.md`
- Kod veya stil konvansiyonları → `code-standards.md`
- Görsel token, düzen deseni, bileşen listesi → `ui-context.md`
- Özellik kapsamı → `project-overview.md`
- Her anlamlı uygulama değişikliği → `progress-tracker.md`

## Before Moving to the Next Unit

1. Birim, tanımlı kapsamı içinde uçtan uca çalışır.
2. `architecture.md`'deki hiçbir değişmez (invariant) ihlal edilmez.
3. Gerçek akış `http://localhost:3000` üzerinde tarayıcıda doğrulanır; kullanılan dizin, branch ve SHA bildirilir.
4. `npx tsc --noEmit` ve `npx eslint .` temiz geçer.
5. İlgili testler geçer; kontrat değiştiyse test yeni davranışa göre güncellenmiştir.
6. `npm run build` geçer.
7. `progress-tracker.md` tamamlanan işi yansıtır.
