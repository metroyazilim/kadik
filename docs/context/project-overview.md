# Extech — Corporate Starter Web Sitesi ve İçerik Yönetimi

## Overview

Extech, Corporate Starter'ın iki dilli (tr = Türkçe, en = Global) kurumsal web sitesi ve bu sitenin tüm içeriğini üreten yönetim uygulamasıdır. Ziyaretçiler yayınlanmış kurumsal içeriği (anasayfa, hakkımızda, hizmetler, ürünler, projeler, ekip, SSS, blog, yasal metinler, iletişim) görür. Yetkili yöneticiler aynı içeriği `/manage` altındaki yönetim panelinden düzenler, taslak olarak saklar ve dil bazında yayınlar. Türkçe ve Global dışındaki diller uygulama i18n'i değildir; ziyaretçinin tarayıcı/Google çevirisiyle karşılanır ve ayrı route, sözlük veya revizyon üretmez. Ürün, ancak bir yöneticinin düzenlediği içeriğin yayınlandıktan sonra ilgili public adreste birebir görünmesiyle başarılı sayılır.

## Goals

1. Tüm public iş içeriği kod değişikliği olmadan yönetilebilir olsun.
2. Türkçe ve Global (İngilizce) içerik birbirinden bağımsız taslaklanıp yayınlanabilsin; başka dil için kanonik route veya çeviri kaydı üretilmesin.
3. Yönetim paneli her ekranı kendi adresi olan gerçek bir sayfa olarak sunsun; hiçbir rutin işlem drawer/modal içinde saklı kalmasın.
4. Bir yönetim ekranının açılması ya da bir kaydın yayınlanması, o ekranın ihtiyaç duyduğundan fazla veri çekmesin.
5. Görsel varlıklar Cloudflare R2 destekli `MediaAsset` kayıtları üzerinden yönetilsin.
6. Her tamamlanan iş `http://localhost:3000` üzerinde uçtan uca gösterilebilsin.


## Roadmap and Current Delivery

`docs/specs/spec-7.md`–`spec-16.md` hedef durumu tarif eder; uygulanmış disk gerçeği `progress-tracker.md` ile izlenir:

- Sayfa yapısı ve component sırası koddadır; admin bölüm ekleyip silmez. `/manage/pages` her public sayfayı listeler ve `/manage/pages/copy/<pageKey>` o sayfanın sabit metinlerini dil bazında düzenler.
- Anasayfa 11 sabit bölümdür; her bölümün metin, görsel, ikon, buton ve bağlantı alanları `/manage/home` akordiyonunda düzenlenir.
- Koleksiyon bölümlerinde grid kolon sayısı, kayıt adedi ve `en yeniler / elle seç / kategori` seçimi admin kararıdır; kart içerikleri kayıt editörlerinde kalır.
- Türkçe taslaktan prompt + sürümlü JSON export edilir; tek model cevabı EN/RU/AR taslaklarına atomik import edilir.
- SEO içerikten otomatik türetilir; route listeli SEO merkezinde SERP/social preview ve güvenli advanced override bulunur.
- SUPER_ADMIN/ADMIN/AUTHOR rolleri, profil/şifre/avatar yönetimi ve ilişkisel blog yazarlığı uygulanır.
- Audit geçmişi terminal görünümünde cursor ile yukarı doğru yüklenir.
- Archive erişilebilir switch olur; kalıcı silme yalnız şifreyle tekrar doğrulanmış kısa ömürlü SUPER_ADMIN Developer Mode capability'sinde çalışır.
- Admin navigasyonu production build üzerinde ölçülür ve kaynak maliyetleri azaltılır.
- `example-starter.com` içeriği runtime bağımlılığı olmadan idempotent CLI importuyla kendi PostgreSQL/MediaAsset verisine alınır.

Bu maddeler uygulanmış özellik iddiası değildir; kanonik kapsam ve sıra `progress-tracker.md` içindedir.

## Core User Flow

1. Yönetici `/manage/login` adresinde e-posta ve şifre ile oturum açar.
2. `/manage` yönetim özetini (içerik sayıları, taslak/yayın durumu, son işlemler) gösterir.
3. Sol kenar çubuğundaki bir bölüm kendi adresine gider: `/manage/services`, `/manage/posts`, `/manage/media`, `/manage/seo` gibi.
4. Liste sayfası o içerik tipinin kayıtlarını sayfalanmış bir tablo olarak gösterir.
5. Yeni kayıt `/manage/<bölüm>/new`, düzenleme `/manage/<bölüm>/<id>` adresinde ayrı bir sayfada yapılır.
6. Yönetici düzenleme sayfasında dil sekmesi seçer, alanları ve zengin metni düzenler, görseli medya kütüphanesinden seçer.
7. Sıralanabilir kayıtlar sürükle-bırak ve klavye ile sıralanır; sıra numarası elle yazılmaz.
8. Kaydetme değişmez (immutable) bir taslak revizyonu üretir.
9. Yayınlama, yayın işaretçisini atomik olarak ileri alır; audit ve invalidation kaydı aynı işlemde yazılır.
10. Public adres yalnızca yayınlanmış revizyonu render eder.

## Features

### Yönetim Paneli

- Sabit kenar çubuğu ve üst çubuktan oluşan tek yönetim kabuğu; her bölüm gerçek bir route
- Liste → düzenleme → yayınla akışı ayrı sayfalarda; drawer/modal rutin akışta kullanılmaz
- Dil sekmeleri, taslak/yayın durum etiketleri, doğrulama hataları, toast bildirimleri
- Sayfalanmış listeler ve liste sorgusunda yalnızca gösterilen alanların çekilmesi
- Denetim kaydı (audit) ve SEO denetim ekranı

### İçerik

- Anasayfa sabit bölüm editörü: hero, hakkımızda, marka logoları, süreç adımları (ikon + başlık + açıklama), KPI (ikon + değer + etiket), referanslar, kayan yazı ve koleksiyon bölümleri
- Hizmet, ürün, proje, ekip, SSS, blog yazısı koleksiyonları (dil bazında bağımsız)
- Hakkımızda, misyon-vizyon, iletişim, yasal metinler ve site ayarları tekil sayfaları
- Uzun metin alanlarında Tiptap tabanlı zengin metin düzenleyici
- dnd-kit ile sürükle-bırak sıralama

### Medya

- Sunucudan alınan yükleme bileti ile Cloudflare R2'ye doğrudan yükleme
- `MediaAsset` kütüphanesinden seçim; serbest dış görsel URL alanı yok
- Kullanım takibi, değiştirme, arşivleme, kayıp nesne tespiti

### Yayınlama ve Yerelleştirme

- Ortak varlık kimliği + dil çevirileri + değişmez revizyonlar
- Dil bazında bağımsız yayınlama
- Public tarafta yalnızca yayınlanmış işaretçiyi okuyan okuyucular
- Route registry, fallback, canonical, hreflang, sitemap ve yönlendirme kuralları
- İletişim formu → yönetim gelen kutusu

## Scope

### In Scope

- Tek Next.js uygulaması ve tek PostgreSQL veritabanı
- `/manage` altında route başına gerçek sayfa mimarisi
- `tr`, `en`, `ru`, `ar` dilleri ve Arapça RTL
- Masaüstü ve mobil duyarlı public/admin yüzeyler
- Kalan sözlük/statik public sayfaların CMS'e taşınması

### Out of Scope

- Drawer/modal tabanlı rutin yönetim akışları
- Yönetim panelinde koyu tema (ilk sürümde)
- Mikroservis mimarisi veya zorunlu iç HTTP sınırı
- Serbest dış görsel URL'leri
- Elle yazılmış zengin metin düzenleyici
- Kullanıcı izni olmadan üretim dağıtımı, yıkıcı migration, DNS değişikliği veya secret üretimi

## Success Criteria

1. Desteklenen herhangi bir içerik tipinde düzenleme + yayınlama, doğru public sayfayı gerçek tarayıcı testinde değiştirir.
2. Her yönetim bölümünün kendi adresi vardır; yenilenebilir, paylaşılabilir, tarayıcı geri tuşuyla gezilebilir.
3. Bir liste sayfası açılırken yalnızca o sayfada gösterilen kayıtlar ve alanlar çekilir.
4. Bir kaydın yayınlanması tek sunucu turunda tamamlanır; ardından tüm sayfayı yeniden kuran bir yenileme tetiklenmez.
5. Türkçe kanonik adresler öneksizdir ve Türkçe segment kullanır (`/hakkimizda`, `/servisler`).
6. Public tarafta görünen her görsel R2 destekli `MediaAsset` kaydından çözülür.
7. Typecheck, lint, testler ve `npm run build` tek proje dizininden geçer.
