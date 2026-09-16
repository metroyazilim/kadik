# Spec 12 — Super Admin Profili, RBAC, Kullanıcı Yönetimi ve Blog Yazarlığı

**Durum:** Hazır — uygulanmadı; eski Spec 6'nın yerini alır  
**Uygulama komutu:** `spec-12 uygula`  
**Oluşturuldu:** 2026-09-08  
**Kanonik depo:** `/Users/berat/extech`  
**Bağımlılık:** Spec 7 tamamlanmış olmalıdır  
**Paralellik:** Tek başına uygulanır; Prisma `AdminUser`, auth/session, admin layout/sidebar ve post authorship sınırlarını sahiplenir  
**Yerine geçtiği belge:** `docs/specs/spec-6.md` diskle uyuşmayan eski taslaktır

## 1. Doğrulanmış Mevcut Durum

Spec yazım anında disk durumu:

- `AdminUser` alanları: `id`, `email`, `passwordHash`, `name`, `tokenVersion`, timestamps; rol ve avatar yok.
- `lib/admin-auth.ts` session payload'ı `userId`, `email`, `name`, `tokenVersion`; role/permission yok.
- `(panel)/layout.tsx` yalnız oturum varlığını kontrol ediyor.
- `AdminSidebar` statik navigasyon; role göre filtre yok.
- `/manage/users` route'u yok.
- `PostEditorPanel` serbest metin `author` input'u kullanıyor; gerçek yönetim kullanıcısına bağlı değil.

Bu nedenle eski progress tracker'daki “Spec 6 RBAC tamamlandı” iddiası geçersizdir. Bu spec temiz ve doğrulanabilir uygulama kaynağıdır.

## 2. Hedef ve Görünür Sonuç

- Mevcut ana yönetici migration ile `SUPER_ADMIN` olur.
- Super admin kendi adını, profil fotoğrafını ve şifresini Ayarlar/Profil ekranından değiştirebilir.
- Super admin admin veya blog yazarı hesaplarını yönetebilir.
- ADMIN içerik ve site yönetebilir, AUTHOR yalnız Blog Yazıları ve Medya alanına erişebilir.
- Sidebar filtrelemesi ile server permission aynı merkezi matristen türetilir.
- Blog kayıtları serbest yazar metni yerine gerçek AdminUser identity'sine bağlanır.
- Public blog liste/detay sayfası gerçek yazar adını ve varsa profil görselini gösterir; kullanıcı sonradan deaktif olsa bile geçmiş attribution kaybolmaz.

## 3. Roller ve Permission Matrisi

```prisma
enum AdminRole {
  SUPER_ADMIN
  ADMIN
  AUTHOR
}
```

| Capability | SUPER_ADMIN | ADMIN | AUTHOR |
| --- | --- | --- | --- |
| Dashboard | evet | evet | sınırlı blog özeti veya `/manage/posts` redirect |
| Pages/sections/home/settings/site-content/SEO/audit/messages | evet | evet | hayır |
| Services/products/projects/team/faq | evet | evet | hayır |
| Blog liste/oluştur/düzenle/yayınla | evet | evet | evet, ownership kurallarıyla |
| Media görüntüle/yükle | evet | evet | evet |
| Media archive/delete | evet | evet | yalnız kendi yüklediği kullanılmayan asset archive; hard delete hayır |
| Kullanıcı listesi | evet | yalnız AUTHOR hesapları | hayır |
| ADMIN/SUPER_ADMIN oluşturma/rol değiştirme | evet | hayır | hayır |
| AUTHOR oluşturma/deaktif/şifre reset | evet | evet | hayır |
| Developer Mode / hard delete | evet | hayır | hayır |
| Kendi profilini düzenleme/şifre | evet | evet | evet |

Kararlar:

- SUPER_ADMIN rolü hiçbir UI akışıyla son aktif super admin'den alınamaz.
- ADMIN kendini SUPER_ADMIN yapamaz ve başka ADMIN'i yönetemez.
- AUTHOR başka bir kullanıcının postunu varsayılan olarak düzenleyemez. ADMIN/SUPER_ADMIN bütün postları düzenleyebilir.
- AUTHOR kendi postunu yayınlayabilir; ayrı editorial approval bu talebin kapsamında değildir.

## 4. Veri Modeli

### 4.1 `AdminUser`

Eklenecek alanlar:

```prisma
role          AdminRole @default(AUTHOR)
active        Boolean   @default(true)
avatarAssetId String?
lastLoginAt   DateTime?
```

- Migration mevcut tüm kullanıcıları güvenli biçimde `SUPER_ADMIN` olarak backfill eder; Prisma default'un yeni kullanıcı için `AUTHOR` olması migration SQL ile mevcut satır backfill'inden ayrıdır.
- `avatarAssetId` `MediaAsset` relation'ı ve inverse relation ile gerçek FK'dir; `onDelete: Restrict`.
- `active=false` login/session çözümünü engeller.
- Email case-insensitive uniqueness PostgreSQL `citext` kullanılmadan uygulama normalization + mevcut unique ile sağlanıyorsa aynı helper tüm create/login/update yollarında kullanılır; gerekirse functional unique index migration'ı açıkça eklenir.

### 4.2 Post attribution

`ContentEntity` yalnız `contentType="post"` için kullanılan nullable alanlar alır:

```prisma
authorUserId       String?
authorNameSnapshot String?
authorAvatarSnapshotAssetId String?
```

- `authorUserId` → `AdminUser`, `onDelete: SetNull`.
- `authorNameSnapshot` post oluşturma veya explicit reassign anında yazılır; kullanıcı deaktif/silinmiş olsa dahi fallback.
- Public çözüm: aktif/deaktif fark etmeksizin user row varsa güncel `name` ve avatar; row yoksa snapshot. Deaktif olmak attribution'ı gizlemez.
- Avatar snapshot asset ID zorunlu olmayabilir; MediaAsset relation tasarımı iki nullable ilişki gerektiriyorsa snapshot yalnız isimde tutulur ve row yoksa avatar gösterilmez. Orphan scalar bırakılmaz.
- Post payload içindeki legacy `author` string migration ile relation/snapshot'a taşınır ve sonra payload schema'dan kaldırılır.

## 5. Session ve Yetki Mimarisi

### 5.1 Session

JWT minimum identity taşır: `userId`, `tokenVersion`; email/name/role her permission kararında DB'den güncel okunur veya kısa request-scope cache kullanılır. Böylece role/name değişimi eski signed claim'e güvenmez.

- Login `active=true` ister.
- Şifre, role veya active değişikliğinde `tokenVersion += 1`.
- Kendi ad/avatar değişikliği session'ı zorunlu sonlandırmaz; DB'den güncel çözüldüğü için yeni shell render'ında görünür.
- Şifre değişikliğinde tüm oturumlar (mevcut dahil) iptal edilir; başarı sonrası login'e redirect ve açık mesaj.

### 5.2 Merkezi permission registry

`lib/admin-permissions.ts`:

- `AdminCapability` closed union.
- role → capability set.
- route prefix → capability.
- contentType → read/create/edit/publish/archive permissions.
- `requireCapability(context, capability)` server helper.

Sidebar görünürlüğü aynı registry'deki nav metadata'sından türetilir. Ayrı role switch yazılmaz.

Her server action kendi capability kontrolünü yapar. Layout route kontrolü defense-in-depth ve doğru redirect/403 UX sağlar; güven sınırı değildir.

### 5.3 Yetkisiz davranış

- Oturum yok: `/manage/login` redirect.
- Oturum var ama route capability yok: güvenli varsayılan route'a redirect + `forbidden=1` toast veya gerçek 403 page. Karar bütün panelde tek olmalıdır; öneri 403 sayfası, çünkü sessiz redirect yetki hatasını gizler.
- Server action capability yok: generic 403 result; Prisma/role detayı sızmaz.
- AUTHOR `/manage` açarsa izin verilen dashboard varyantı yoksa `/manage/posts` redirect.

## 6. Kullanıcı Yönetimi

Routes:

- `/manage/users` — sayfalanmış kullanıcı listesi.
- `/manage/users/[id]` — kullanıcı detay/düzenleme.
- Oluşturma ayrı server action + redirect; rutin modal/drawer yok.

Liste alanları:

- avatar, ad, email, role, active/deaktif, post sayısı, son giriş, createdAt.
- Role ve status filtreleri.
- Payload/secret/passwordHash query'ye girmez.

### 6.1 Oluşturma

- name, normalized email, role, geçici password veya güvenli server-generated temporary credential.
- Email gönderim sistemi yoksa parola admin tarafından iki kez girilir; plaintext hiçbir log/audit'e yazılmaz.
- ADMIN yalnız AUTHOR oluşturabilir.
- SUPER_ADMIN AUTHOR veya ADMIN oluşturabilir. Yeni SUPER_ADMIN oluşturma ayrı mevcut şifre reauth ister.

### 6.2 Düzenleme

- name, email, role, active, avatar.
- Role/active değişimi tokenVersion artırır.
- Son aktif SUPER_ADMIN deaktif edilemez/düşürülemez.
- Kullanıcı hard delete edilmez; deactivate edilir. Audit ve post attribution korunur.
- Şifre reset yeni hash + tokenVersion; plaintext response/log/audit yok.

## 7. Kendi Profilim

Route: `/manage/profile` veya Site Ayarları içindeki ayrı “Profilim” route linki. Global site settings payload'ına kullanıcı profili gömülmez.

Kartlar:

1. **Profil:** ad, email (permission/policy'ye göre), MediaAsset avatar seçimi/yükleme, preview.
2. **Şifre:** mevcut şifre, yeni şifre, tekrar; password manager-friendly autocomplete.
3. **Oturum:** rol, son giriş, “Tüm oturumlarımı kapat”.
4. **Developer Mode:** yalnız SUPER_ADMIN; gerçek aktivasyon Spec 14'te eklenir, bu spec placeholder/no-op eklemez. Spec 14 öncesi kart hiç gösterilmez veya bilgilendirici disabled tasarım değil, tamamen yoktur.

Şifre politikası mevcut auth standardını korur/güçlendirir: minimum uzunluk, breached-password harici servisi eklenmez, maximum byte length hashing DoS'a karşı bounded.

## 8. Blog Oluşturma ve Atama

- Yeni post entity oluşturulurken current user `authorUserId` ve snapshot olarak atanır.
- Author serbest textbox kaldırılır.
- AUTHOR editöründe yazar kartı salt okunur.
- ADMIN/SUPER_ADMIN, mevcut aktif ADMIN/AUTHOR listesinden yazar değiştirebilir; değişiklik audit olur.
- Post listesinde yazar avatar/ad ve “Benim yazılarım” filtresi.
- AUTHOR query server'da `authorUserId=currentUser.id` ile sınırlanır; client filtresine güvenilmez.
- ADMIN bir postu AUTHOR'a atayabilir; AUTHOR sonraki girişte görür.

Legacy author migration:

- Legacy string normalize edilip kullanıcı adı/email ile tekil eşleşirse bağlanır.
- Belirsiz/eşleşmeyen string snapshot olarak korunur, `authorUserId=null`.
- Boş author current migration actor'a otomatik uydurulmaz; “Metro Yazılım” gibi mevcut public fallback varsa açık registry fallback'ına taşınır.
- Migration raporu matched/unmatched/ambiguous sayıları verir.

## 9. Public Yazar Görünümü

Blog listesi ve detay view model'i:

```ts
type PublicPostAuthor = {
  name: string;
  avatar: PublicMediaView | null;
  profilePath: string | null;
};
```

- En az ad görünür.
- Avatar varsa MediaAsset resolver ve alt `"<ad> profil fotoğrafı"` veya kullanıcı tarafından yönetilen uygun alt ile.
- Public yazar profil route'u mevcutsa link; yoksa sahte link üretilmez.
- JSON-LD BlogPosting author Spec 11 resolver'ına bağlanır.
- Email/role/admin identity ID public payload'a çıkmaz.

## 10. Avatar Medya Kuralları

- Mevcut MediaPicker/MediaAsset kullanılır; base64 veya dış URL yok.
- Kabul edilen image MIME/size mevcut medya doğrulaması.
- Avatar crop UI zorunlu değildir; kare preview + object-fit cover.
- MediaUsage `surface="admin-user"`, field=`avatar`, entityId null veya ayrı user relation; usage dependency raporunda kullanıcı adı görünür.
- Bir avatar asset kullanımdayken medya delete blocker'ı çalışır.

## 11. Audit

Olaylar:

- user.create, user.update, user.role.change, user.activate/deactivate, user.password.reset
- profile.update, profile.password.change, session.revoke-all
- post.author.assign/reassign
- auth.login.success/failure (secret içermeden)

Metadata email gibi PII'yi gereksiz kopyalamaz; actor/target user ID ve changed field names yeterlidir. Password hiçbir formda audit metadata'ya girmez.

## 12. Dosya Sahipliği

- `prisma/schema.prisma` ve bu spec migration'ı
- `lib/admin-auth.ts`
- `lib/admin-permissions.ts` (yeni)
- `lib/content-model/admin-context.ts`
- `app/manage/(panel)/layout.tsx`
- `components/admin/AdminSidebar.tsx`, `AdminShell.tsx` user summary
- `app/manage/(panel)/users/**` (yeni)
- `app/manage/(panel)/profile/**` (yeni)
- `app/manage/(panel)/posts/**`
- Post create/edit/list actions and queries
- `lib/public-pages/blog-post-detail.tsx`, blog list/card view models
- Media usage integration only for avatars

Spec 12 uygulanırken Spec 14 aynı checkout'a yazmaz.

## 13. Kabul Kriterleri

1. **AC-12.1** Migration mevcut kullanıcıları SUPER_ADMIN yapar; yeni user default'u güvenli biçimde AUTHOR'dır.
2. **AC-12.2** Merkezi permission registry sidebar, route guard, list query ve server action tarafından ortak kullanılır.
3. **AC-12.3** AUTHOR yalnız kendi Blog Yazıları ve izin verilen Medya yüzeyini görür; doğrudan başka route/action erişimi engellenir.
4. **AC-12.4** ADMIN AUTHOR hesabı oluşturabilir/deaktif edebilir fakat ADMIN/SUPER_ADMIN rolü veremez.
5. **AC-12.5** Son aktif SUPER_ADMIN deaktif edilemez veya rolü düşürülemez.
6. **AC-12.6** Role/active/password değişikliği tokenVersion artırır ve eski session'ı geçersiz kılar.
7. **AC-12.7** Her kullanıcı kendi adını/avatarını güncelleyebilir ve mevcut şifre doğrulamasıyla şifresini değiştirebilir.
8. **AC-12.8** Post author serbest metin input'u yoktur; yeni post current user'a ilişkisel bağlanır.
9. **AC-12.9** AUTHOR list/query/action seviyesinde başka yazarın postunu okuyamaz/düzenleyemez; yalnız UI filtresi değildir.
10. **AC-12.10** ADMIN/SUPER_ADMIN aktif kullanıcı seçicisinden post yazarı atayabilir; public liste/detay doğru ad/avatarı gösterir.
11. **AC-12.11** Kullanıcı deaktif olduğunda yayımlanmış post attribution kaybolmaz; email/role/user ID public response'a çıkmaz.
12. **AC-12.12** Legacy author migration belirsiz eşleşmeyi yanlış kullanıcıya bağlamaz ve raporlar.
13. **AC-12.13** Kullanıcı/şifre/rol/yazar değişimleri güvenli audit event üretir; plaintext password/token yoktur.
14. **AC-12.14** Kullanımdaki avatar asset media hard delete tarafından bloklanır.

## 14. Test ve Gerçek Doğrulama

### Kalıcı testler

- Permission matrix table-driven.
- Route + direct action denial.
- AUTHOR ownership query.
- Last-super-admin invariant under concurrent deactivation transaction.
- tokenVersion invalidation.
- Legacy author migration ambiguous/unmatched.
- Public author privacy shape.

### Browser senaryosu

1. SUPER_ADMIN profile ad/avatar güncelle; sidebar yansısın.
2. AUTHOR kullanıcı oluştur.
3. AUTHOR ile login; yalnız Blog/Medya nav'ı, `/manage/services` 403.
4. AUTHOR post oluştur/yayınla; public list/detail ad/avatarı göstersin.
5. SUPER_ADMIN postu başka aktif yazara reassign et; public attribution publish semantiğine göre güncellensin.
6. AUTHOR'ı deactivate et; session iptal, public attribution korunur.
7. Kendi şifresini değiştir; eski cookie ve eski şifre çalışmasın, yeni şifre çalışsın.
8. Test kullanıcı/post verisini kontrollü temizle veya deactivate fixture'ını resetle.

### Komutlar

- `npx prisma validate`
- `npx prisma migrate dev`
- `npx tsc --noEmit`
- `npx eslint .`
- ilgili integration/E2E testleri
- `npm run build`

## 15. Riskler

- **Eski Spec 6 yanlış tamamlanmış sayılır:** progress tracker disk gerçeğine göre düzeltilir.
- **UI-only RBAC:** bütün query/action servisleri capability kontrolü yapar.
- **Stale JWT role:** permission anında DB identity çözülür; tokenVersion revocation.
- **Yazar adı kaybı:** relation + snapshot fallback.
- **Son super admin lockout:** transaction içinde active SUPER_ADMIN count guard.
- **Avatar orphan:** MediaAsset FK/usage takibi.

## 16. Definition of Done

- SUPER_ADMIN/ADMIN/AUTHOR matrisinin UI, route, query ve action katmanlarında çalıştığı kanıtlanmıştır.
- Kullanıcı yönetimi ve kendi profil/şifre/avatar akışı tamamdır.
- Blog attribution gerçek kullanıcıya bağlıdır ve public görünür.
- Eski author textbox/alan alias'ı temizlenmiştir.
- Typecheck, lint, ilgili testler ve build geçmiştir.
- `architecture.md`, `project-overview.md` ve `progress-tracker.md` gerçek duruma güncellenmiştir.
