/**
 * KADİK açılış içeriği: kurul üyeleri + yayınlar.
 *
 * Görselleri `scripts/media-import.ts` üzerinden WebP (q85) olarak Cloudflare
 * R2'ye yükler, ardından içerikleri yönetim panelinin kullandığı gerçek
 * akışla (`createCollectionEntity` → `ensureLocaleTranslation` →
 * `adminSaveDraft` → `adminPublish`) yazar. Böylece seed edilen kayıtlar
 * panelde düzenlenebilir, public sayfalarda yayınlanmış revizyon olarak
 * görünür ve route/outbox/audit kayıtları elle yazılmış bir SQL seed'inde
 * olmayacak şekilde tutarlı kalır.
 *
 * Kullanım:
 *   npx tsx scripts/seed-kadik-content.ts
 *
 * Idempotent: aynı slug'a sahip yayınlanmış bir kayıt varsa o kayıt atlanır.
 * Kurul üyelerinin gerçek fotoğrafları geldiğinde görseller
 * `npx tsx scripts/media-import.ts --dir <klasör>` ile yüklenip panelden
 * ilgili üyeye bağlanır; bu script'in ürettiği geçici portreler o noktada
 * arşivlenebilir.
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, extname, resolve as resolvePath } from "node:path";
import type { ContentLocale, Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import type { AdminContext } from "../lib/content-model/admin-context";
import { adminPublish, adminSaveDraft } from "../lib/content-model/admin-content-store";
import { createCollectionEntity, ensureLocaleTranslation } from "../lib/content-model/collection-admin";
import { contentAvailabilityTag, contentEntityTag, seoIndexTag } from "../lib/content-model/cache-tags";
import { syncFieldMediaUsage } from "../lib/content-model/content-media";
import type { ContentBlock } from "../lib/content-model/content-blocks";
import { persistedOutboxRecorder } from "../lib/content-model/outbox-store";
import {
  POST_CONTENT_TYPE,
  POST_SCHEMA_VERSION,
  TEAM_MEMBER_CONTENT_TYPE,
  TEAM_MEMBER_SCHEMA_VERSION,
  type PostPayload,
  type TeamMemberPayload,
} from "../lib/content-model/payload-validation";
import { postRouteCandidate } from "../lib/content-model/post-routes";
import { slugifyTitle } from "../lib/content-model/slugify";
import { teamMemberRouteCandidate } from "../lib/content-model/team-routes";
import { importImageAsset, scriptAdminContext } from "./media-import";

const LOCALE: ContentLocale = "tr";
const SEED_IMAGE_DIR = resolvePath(import.meta.dirname, "../.local/seed-images");
const PLACEHOLDER_CAPTION = "Geçici temsili görsel - gerçek fotoğrafla değiştirilecek.";

type BoardMemberSeed = Readonly<{
  name: string;
  role: string;
  bio: string;
  photo: string;
}>;

const BOARD_MEMBERS: readonly BoardMemberSeed[] = [
  {
    name: "Bob Farmer",
    role: "Yönetim Kurulu Başkanı",
    bio: "Uluslararası ticaret ve yatırım alanında uzun yıllara dayanan deneyimiyle konseyin dış temsil gündemini yürütüyor. Üye şirketlerin yeni pazarlara açılmasını destekleyen iş birliği programlarının kurulmasında rol aldı.",
    photo: "kurul-portre-6.webp",
  },
  {
    name: "Yaşar Karadağ",
    role: "Başkan Yardımcısı",
    bio: "Sanayi ve üretim tarafında edindiği saha deneyimini konseyin sektör kurulları çalışmasına taşıyor. Üyeler arasında tedarik ve iş ortaklığı bağlantılarının kurulmasından sorumlu.",
    photo: "kurul-portre-1.webp",
  },
  {
    name: "Taylan Engin",
    role: "Yönetim Kurulu Üyesi",
    bio: "Genç girişimciler ve teknoloji odaklı şirketlerle yürütülen mentorluk programlarını koordine ediyor. Dijitalleşme ve verimlilik başlıklarında üyelere yönelik eğitim içeriklerini hazırlıyor.",
    photo: "kurul-portre-2.webp",
  },
  {
    name: "Ali Ayter",
    role: "Yönetim Kurulu Üyesi",
    bio: "Finansmana erişim, teşvik mekanizmaları ve yatırım planlaması konularında üye şirketlere yön veren çalışma grubunu yürütüyor. Konseyin bütçe ve denetim süreçlerinde görev alıyor.",
    photo: "kurul-portre-3.webp",
  },
  {
    name: "İlyas Karabıyık",
    role: "Yönetim Kurulu Üyesi",
    bio: "Lojistik ve dış ticaret operasyonlarındaki deneyimiyle ihracat heyetlerinin planlanmasına katkı sunuyor. Bölgesel iş buluşmalarının organizasyonunu üstleniyor.",
    photo: "kurul-portre-4.webp",
  },
  {
    name: "Orhan Selim Bayraktar",
    role: "Yönetim Kurulu Üyesi",
    bio: "Kurumsal yönetişim, insan kaynağı ve çalışma yaşamı başlıklarında konsey politikalarının hazırlanmasında görev alıyor. Üye şirketlere yönelik danışma toplantılarını yönetiyor.",
    photo: "kurul-portre-5.webp",
  },
];

type PostSeed = Readonly<{
  title: string;
  excerpt: string;
  category: string;
  author: string;
  cover: string;
  /** Gövde içindeki görsel bloğu için R2'ye yüklenecek kaynak. */
  inlineImage?: string;
  blocks: (inlineImageAssetId: string | null) => readonly ContentBlock[];
}>;

const POSTS: readonly PostSeed[] = [
  {
    title: "Üretimden ihracata: KOBİ'ler için birlikte büyüme modeli",
    excerpt:
      "Tek başına büyümek yerine ortak tedarik, ortak pazar araştırması ve ortak temsil; orta ölçekli şirketlerin dış pazarlarda kalıcı olmasını sağlıyor.",
    category: "Makale",
    author: "KADİK Sekreteryası",
    cover: "yayin-kapak-1.webp",
    inlineImage: "is-galeri-5.webp",
    blocks: (inlineImageAssetId) => [
      {
        id: "giris",
        type: "text",
        html: "<p>Orta ölçekli şirketlerin dış pazarlarda karşılaştığı sorun çoğu zaman ürün kalitesi değil; ölçek, temsil ve finansman erişimi oluyor. Tek bir şirketin tek başına üstlenmesi zor olan fuar katılımı, pazar araştırması ve sertifikasyon maliyetleri, aynı sektörden birkaç şirket bir araya geldiğinde yönetilebilir hale geliyor.</p><p>Konsey olarak yürüttüğümüz çalışmalarda üç başlığın belirleyici olduğunu görüyoruz: <strong>ortak tedarik</strong>, <strong>ortak pazar bilgisi</strong> ve <strong>kurumsal kapasite</strong>. Bu üç başlık, üyelerimizin sektör kurullarında bir araya geldiği gündemin de omurgasını oluşturuyor.</p>",
      },
      {
        id: "hedefler",
        type: "kpi",
        heading: "2026 dönem hedeflerimiz",
        items: [
          { label: "Sektör kurulu", value: "12" },
          { label: "Üye şirket buluşması", value: "24" },
          { label: "İhracat heyeti", value: "6" },
          { label: "Eğitim programı", value: "18" },
        ],
      },
      {
        id: "ortak-tedarik",
        type: "text",
        html: "<h3>Ortak tedarik ölçek kazandırıyor</h3><p>Hammadde ve ambalaj gibi kalemlerde birlikte alım yapan üyelerimiz, hem birim maliyetini hem de teslim sürelerini iyileştiriyor. Sektör kurulları bu alımların planlanmasında şeffaf bir takvim yürütüyor; sonuçlar dönem raporlarında üyelerle paylaşılıyor.</p><h3>Pazar bilgisi paylaşıldığında değer üretiyor</h3><p>Hedef pazarlardaki mevzuat, gümrük ve dağıtım kanalı bilgisi tek tek şirketlerde kalmak yerine kurul raporlarına dönüşüyor. Yeni bir pazara giren üyenin öğrendiği her şey, aynı pazara sonra girecek üyenin yol haritası oluyor.</p>",
      },
      ...(inlineImageAssetId
        ? [
            {
              id: "kurul-gorsel",
              type: "image" as const,
              assetId: inlineImageAssetId,
              caption: "Sektör kurulu çalışma toplantısı.",
            },
          ]
        : []),
      {
        id: "alinti",
        type: "quote",
        text: "Rekabet ettiğimiz alan ürün; iş birliği yaptığımız alan ise altyapı, bilgi ve temsil olmalı.",
        author: "KADİK Sektör Kurulları Çalışma Notu",
      },
      {
        id: "kapanis",
        type: "text",
        html: "<h3>Kurumsal kapasite kalıcılığı belirliyor</h3><p>Finansal raporlama, sözleşme yönetimi ve insan kaynağı süreçleri güçlenmeden dış pazarda kalıcı olmak mümkün değil. Bu nedenle üyelerimize yönelik eğitim programlarını sektör kurullarının gündemiyle eşleştiriyor, her dönem sonunda katılımcı geri bildirimiyle güncelliyoruz.</p>",
      },
      {
        id: "cta",
        type: "banner",
        heading: "Sektör kurullarına katılın",
        text: "Üyelik başvurunuzu tamamladığınızda faaliyet alanınıza en yakın sektör kuruluna davet ediliyorsunuz.",
        imageAssetId: null,
        ctaLabel: "Üyelik başvurusu",
        ctaUrl: "/uyelik",
      },
    ],
  },
  {
    title: "Sektör kurulları 2026 dönem toplantıları başlıyor",
    excerpt:
      "Yeni dönemde sektör kurulları aylık takvimle toplanacak; gündemde tedarik zinciri, ihracat finansmanı ve nitelikli iş gücü başlıkları var.",
    category: "Haber",
    author: "KADİK Sekreteryası",
    cover: "yayin-kapak-2.webp",
    blocks: () => [
      {
        id: "duyuru",
        type: "text",
        html: "<p>Konsey sektör kurulları 2026 dönem çalışmalarına başlıyor. Kurullar bu dönem aylık takvimle toplanacak; her toplantının çıktısı üyelerle paylaşılan kısa bir gündem notuna dönüşecek.</p><p>İlk turda öne çıkan başlıklar şunlar:</p><ul><li>Tedarik zincirinde alternatif kaynak planlaması</li><li>İhracat finansmanı ve teşvik başvurularında ortak danışma</li><li>Nitelikli iş gücü ve mesleki eğitim iş birlikleri</li><li>Dijitalleşme yatırımlarında ölçülebilir verimlilik</li></ul>",
      },
      {
        id: "katilim",
        type: "text",
        html: "<h3>Katılım ve takvim</h3><p>Toplantı yeri ve saatleri üyelerimize e-posta ile iletiliyor, güncel takvim etkinlikler sayfasında yayımlanıyor. Kurul çalışmalarına katılmak isteyen şirketler üyelik başvurusunu tamamladıktan sonra faaliyet alanlarına uygun kurula yönlendiriliyor.</p>",
      },
      {
        id: "cta",
        type: "banner",
        heading: "Takvimi takip edin",
        text: "Etkinlik ve toplantı duyurularının tamamı konseyin etkinlik takviminde yer alıyor.",
        imageAssetId: null,
        ctaLabel: "Etkinlik takvimi",
        ctaUrl: "/etkinlikler",
      },
    ],
  },
];

async function publishedSlugExists(contentType: string, collectionSegment: string, slug: string): Promise<boolean> {
  const route = await prisma.contentRoute.findUnique({
    where: { contentType_locale_collectionSegment_slug: { contentType, locale: LOCALE, collectionSegment, slug } },
    select: { id: true },
  });
  return route !== null;
}

/** Tek bir koleksiyon kaydını taslak olarak yazıp aynı revizyonu yayımlar. */
async function createPublishedRecord(input: {
  context: AdminContext;
  contentType: string;
  schemaVersion: number;
  collectionSegment: string;
  slug: string;
  payload: Prisma.InputJsonValue;
  collectionTag: string;
  mediaField: Readonly<{ field: string; assetIds: readonly (string | null)[] }>;
}): Promise<string> {
  const { entityId } = await createCollectionEntity(prisma, input.context, input.contentType);
  const translation = await ensureLocaleTranslation(prisma, input.context, entityId, LOCALE);

  const draft = await adminSaveDraft(prisma, input.context, {
    translationId: translation.translationId,
    expectedVersion: translation.version,
    schemaVersion: input.schemaVersion,
    payload: input.payload,
  });
  if (!draft.ok) throw new Error(`Taslak kaydedilemedi (${input.contentType}/${input.slug}).`);

  const published = await adminPublish(
    prisma,
    input.context,
    {
      translationId: translation.translationId,
      expectedVersion: draft.translation.version,
      expectedDraftRevisionId: draft.revisionId,
    },
    {
      candidate:
        input.contentType === TEAM_MEMBER_CONTENT_TYPE
          ? teamMemberRouteCandidate(LOCALE, input.slug)
          : postRouteCandidate(LOCALE, input.slug),
    },
    {
      recorder: persistedOutboxRecorder,
      tags: [contentEntityTag(entityId), contentAvailabilityTag(entityId, LOCALE), input.collectionTag, seoIndexTag()],
    },
  );
  if (!published.ok) throw new Error(`Yayınlanamadı (${input.contentType}/${input.slug}).`);

  await syncFieldMediaUsage(prisma, {
    entityId,
    locale: LOCALE,
    surface: input.contentType,
    field: input.mediaField.field,
    assetIds: input.mediaField.assetIds,
  });

  return entityId;
}

async function seedBoardMembers(context: AdminContext): Promise<void> {
  for (const member of BOARD_MEMBERS) {
    const slug = slugifyTitle(member.name);
    if (await publishedSlugExists(TEAM_MEMBER_CONTENT_TYPE, "ekip", slug)) {
      console.log(`- atlandı (zaten yayında): ${member.name}`);
      continue;
    }

    // Görsel dosyası yoksa kayıt yine yayınlanır: public okuyucu eksik
    // asset'i güvenli yer tutucuya düşürür (`resolvePublicImage`), böylece
    // temiz bir checkout'ta seed yarıda kalmaz.
    const photoPath = resolvePath(SEED_IMAGE_DIR, member.photo);
    const asset = existsSync(photoPath)
      ? await importImageAsset({
          source: photoPath,
          filename: `kurul-${slug}`,
          altText: `${member.name} portresi`,
          caption: PLACEHOLDER_CAPTION,
          maxWidth: 900,
          context,
        })
      : null;
    if (!asset) console.warn(`  ! görsel bulunamadı, yer tutucu ile yayınlanıyor: ${photoPath}`);

    const payload: TeamMemberPayload = {
      name: member.name,
      slug,
      role: member.role,
      imageAssetId: asset?.assetId ?? null,
      email: null,
      phone: null,
      social: null,
      bio: member.bio,
      seoTitle: null,
      seoDescription: null,
    };

    await createPublishedRecord({
      context,
      contentType: TEAM_MEMBER_CONTENT_TYPE,
      schemaVersion: TEAM_MEMBER_SCHEMA_VERSION,
      collectionSegment: "ekip",
      slug,
      payload: payload as unknown as Prisma.InputJsonValue,
      collectionTag: "team-member:collection",
      mediaField: { field: "image", assetIds: [asset?.assetId ?? null] },
    });
    console.log(`+ kurul üyesi yayınlandı: ${member.name} (${member.role}) -> /ekip/${slug}`);
  }
}

async function seedPosts(context: AdminContext): Promise<void> {
  for (const post of POSTS) {
    const slug = slugifyTitle(post.title);
    if (await publishedSlugExists(POST_CONTENT_TYPE, "blog", slug)) {
      console.log(`- atlandı (zaten yayında): ${post.title}`);
      continue;
    }

    const coverPath = resolvePath(SEED_IMAGE_DIR, post.cover);
    const cover = existsSync(coverPath)
      ? await importImageAsset({ source: coverPath, filename: `yayin-${slug}`, altText: post.title, maxWidth: 1600, context })
      : null;
    if (!cover) console.warn(`  ! kapak görseli bulunamadı, yer tutucu ile yayınlanıyor: ${coverPath}`);

    const inlinePath = post.inlineImage ? resolvePath(SEED_IMAGE_DIR, post.inlineImage) : null;
    const inline = inlinePath && existsSync(inlinePath)
      ? await importImageAsset({
          source: inlinePath,
          filename: `yayin-${slug}-icerik`,
          altText: "Sektör kurulu çalışma toplantısı",
          maxWidth: 1400,
          context,
        })
      : null;

    const blocks = post.blocks(inline?.assetId ?? null);
    const payload: PostPayload = {
      title: post.title,
      slug,
      excerpt: post.excerpt,
      blocks,
      category: post.category,
      author: post.author,
      coverImageAssetId: cover?.assetId ?? null,
      seoTitle: null,
      seoDescription: null,
    };

    await createPublishedRecord({
      context,
      contentType: POST_CONTENT_TYPE,
      schemaVersion: POST_SCHEMA_VERSION,
      collectionSegment: "blog",
      slug,
      payload: payload as unknown as Prisma.InputJsonValue,
      collectionTag: "post:collection",
      mediaField: { field: "blocks", assetIds: [cover?.assetId ?? null, inline?.assetId ?? null] },
    });
    console.log(`+ yayın yayınlandı: ${post.title} -> /yazilar/${slug}`);
  }
}

/**
 * Gerçek kurul fotoğrafları geldiğinde tek komutluk değiştirme yolu:
 * dosya adı üyenin adına karşılık gelir (`yasar-karadag.jpg`,
 * `Yaşar Karadağ.jpeg`, `bob-farmer.png` hepsi çalışır - ad slug'a
 * indirgenip yayınlanmış route ile eşleştirilir). Görsel WebP q85 olarak
 * R2'ye yüklenir, üyenin yayınlanmış payload'ı aynı slug ile yeniden
 * yayımlanır; eşleşmeyen dosya sessizce geçilmez, uyarı basılır.
 */
async function replaceBoardPhotos(context: AdminContext, directory: string): Promise<void> {
  const files = readdirSync(directory).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));
  if (files.length === 0) throw new Error(`Klasörde görsel yok: ${directory}`);

  for (const file of files) {
    const slug = slugifyTitle(basename(file, extname(file)));
    const route = await prisma.contentRoute.findUnique({
      where: { contentType_locale_collectionSegment_slug: { contentType: TEAM_MEMBER_CONTENT_TYPE, locale: LOCALE, collectionSegment: "ekip", slug } },
      select: { entityId: true, translationId: true },
    });
    if (!route) {
      console.warn(`- eşleşen kurul üyesi yok, atlandı: ${file} (aranan slug: ${slug})`);
      continue;
    }

    const translation = await prisma.contentTranslation.findUnique({
      where: { id: route.translationId },
      include: { draftRevision: true, publishedRevision: true },
    });
    const current = (translation?.draftRevision?.payload ?? translation?.publishedRevision?.payload ?? null) as TeamMemberPayload | null;
    if (!translation || !current) {
      console.warn(`- kayıtlı içerik okunamadı, atlandı: ${file}`);
      continue;
    }

    const asset = await importImageAsset({
      source: resolvePath(directory, file),
      filename: `kurul-${slug}`,
      altText: `${current.name} portresi`,
      maxWidth: 900,
      context,
    });

    const draft = await adminSaveDraft(prisma, context, {
      translationId: translation.id,
      expectedVersion: translation.version,
      schemaVersion: TEAM_MEMBER_SCHEMA_VERSION,
      payload: { ...current, imageAssetId: asset.assetId } as unknown as Prisma.InputJsonValue,
    });
    if (!draft.ok) throw new Error(`Taslak kaydedilemedi: ${current.name}`);

    const published = await adminPublish(
      prisma,
      context,
      { translationId: translation.id, expectedVersion: draft.translation.version, expectedDraftRevisionId: draft.revisionId },
      { candidate: teamMemberRouteCandidate(LOCALE, current.slug) },
      {
        recorder: persistedOutboxRecorder,
        tags: [contentEntityTag(route.entityId), contentAvailabilityTag(route.entityId, LOCALE), "team-member:collection", seoIndexTag()],
      },
    );
    if (!published.ok) throw new Error(`Yayınlanamadı: ${current.name}`);

    await syncFieldMediaUsage(prisma, {
      entityId: route.entityId,
      locale: LOCALE,
      surface: TEAM_MEMBER_CONTENT_TYPE,
      field: "image",
      assetIds: [asset.assetId],
    });
    console.log(`+ fotoğraf güncellendi: ${current.name} -> ${asset.url}`);
  }
}

async function run(): Promise<void> {
  const context = await scriptAdminContext();
  const photosFlagIndex = process.argv.indexOf("--photos");
  if (photosFlagIndex !== -1) {
    const directory = process.argv[photosFlagIndex + 1];
    if (!directory) throw new Error("Kullanım: npx tsx scripts/seed-kadik-content.ts --photos <klasör>");
    console.log(`Kurul fotoğrafları güncelleniyor: ${directory}`);
    await replaceBoardPhotos(context, resolvePath(process.cwd(), directory));
    console.log("Bitti.");
    return;
  }

  console.log("KADİK içerik seed'i başlıyor (kurul üyeleri + yayınlar)…");
  await seedBoardMembers(context);
  await seedPosts(context);
  console.log("Bitti.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
