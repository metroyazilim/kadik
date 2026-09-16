# Spec 6 — Arşivlenmiş Taslak: Blog Yazarı Rolü ve Kullanıcı Yönetimi

**Durum:** Uygulanmayacak — disk üzerinde rol, kullanıcı route'u ve ilişkisel post yazarlığı yoktur; ayrıntılı ve doğrulanabilir yeni kontrat Spec 12'dir.  
**Yerine geçen belge:** `docs/specs/spec-12.md`  
**Kanonik Depo:** `/Users/berat/extech`  
**Paralellik:** Bu belge çalıştırılmaz.

---

## 1. Hedef ve Görünür Sonuç
Sisteme Rol Tabanlı Erişim Kontrolü (RBAC) kazandırılarak **Blog Yazarı (AUTHOR)** rolünün oluşturulması.
- Admin'in yeni blog yazarı hesapları oluşturabilmesi.
- Blog yazarının yönetim paneline girdiğinde **sadece Blog Yazıları ve Medya Kütüphanesi** alanlarını görebilmesi, diğer tüm yönetim sayfalarından engellenmesi.
- Blog yazarlarının veya adminin yazdığı yazıların altında kendi isimlerinin dinamik olarak yer alması.

---

## 2. Kapsam İçi ve Kapsam Dışı

### Kapsam İçi:
- `prisma/schema.prisma` dosyasında `AdminUser` modeline `name String`, `role AdminRole @default(ADMIN)` (enum: `ADMIN`, `AUTHOR`) alanlarının eklenmesi ve migration oluşturulması.
- Adminler için `/manage/users` Kullanıcı Yönetimi ekranı (yeni yazar ekleme, listeleme, şifre sıfırlama, silme).
- `lib/admin-auth.ts` ve `app/manage/(panel)/layout.tsx` içinde rol kontrolü: Giriş yapan kullanıcının rolü `AUTHOR` ise yalnızca `/manage/posts` ve `/manage/media` route'larına izin verilir; başka bir adrese giderse `/manage/posts` sayfasına yönlendirilir.
- `components/admin/AdminSidebar.tsx` bileşeninde role göre menü filtreleme (Yazara sadece Blog ve Medya gösterilir).
- Blog oluşturma/düzenleme ekranında (`/manage/posts/[id]`) yazar bilgisinin oturumdaki kullanıcının adıyla (`user.name`) otomatik bağlanması.
- Public blog detayında (`lib/public-pages/blog-post-detail.tsx`) ve blog kartlarında (`BlogCard.tsx`) ilgili yazarın isminin gösterilmesi.

### Kapsam Dışı:
- Müşteri veya ziyaretçi kullanıcı hesapları (bu sistem sadece yönetim paneli kullanıcıları içindir).
- Detaylı izin matrisleri (sadece iki rol vardır: `ADMIN` ve `AUTHOR`).

---

## 3. Kabul Kriterleri (Acceptance Criteria)
- **AC-6.1:** Admin `/manage/users` adresine giderek "Ahmet Yılmaz" adında, `AUTHOR` rolünde yeni bir kullanıcı oluşturabilir.
- **AC-6.2:** Bu kullanıcı ile giriş yapıldığında sol menüde sadece "Blog Yazıları" ve "Medya" linkleri görünür; `/manage/services` veya `/manage/site-settings` gibi adreslere manuel gitmeye çalıştığında 403 veya `/manage/posts` redirect alır.
- **AC-6.3:** Yazar yeni bir blog yazıp yayınladığında yazar bilgisi otomatik olarak "Ahmet Yılmaz" olur.
- **AC-6.4:** Admin giriş yapıp kendi adıyla ("Berat") bir yazı yayınlarsa blogun altında "Yazar: Berat" yazar.
- **AC-6.5:** Public blog sayfasında ve blog listesinde doğru yazar adı görünür.

---

## 4. Doğrulama ve Test Adımları
- `npx prisma migrate dev` ile migration uygulanır.
- `npx tsc --noEmit` ve `npm run build` temiz geçer.
- E2E senaryosu: Admin yazar oluşturur -> Yazar ile giriş yapılır -> Yetkisiz sayfaya erişim denenir (engellenir) -> Yazar blog yayınlar -> Public sayfada yazar adı doğrulanır.
