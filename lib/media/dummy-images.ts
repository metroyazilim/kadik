/**
 * Yer tutucu (dummy) görseller. Yönetim panelinden gerçek görsel seçilene
 * kadar kartlar/bölümler bu Unsplash fotoğraflarını gösterir; admin bir
 * `MediaAsset` seçtiği anda o görsel devralır ve burası devre dışı kalır.
 *
 * Tek kaynak: hiçbir bileşen kendi başına görsel URL'i uydurmaz.
 */
const UNSPLASH = "https://images.unsplash.com";

function photo(id: string, width: number, height: number): string {
  return `${UNSPLASH}/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}

/** Geniş hero/banner arka planı. */
export const DUMMY_HERO_IMAGE = photo("photo-1522071820081-009f0129c71c", 1920, 1080);

/** Hakkımızda ve metin+görsel bölümleri. */
export const DUMMY_ABOUT_IMAGE = photo("photo-1552664730-d307ca884978", 1200, 900);

/** Kart görselleri: sıra, karta göre deterministik seçilir. */
export const DUMMY_SERVICE_IMAGES = [
  photo("photo-1498050108023-c5249f4df085", 800, 600),
  photo("photo-1461749280684-dccba630e2f6", 800, 600),
  photo("photo-1512941937669-90a1b58e7e9c", 800, 600),
  photo("photo-1556742049-0cfed4f6a45d", 800, 600),
  photo("photo-1573164713988-8665fc963095", 800, 600),
  photo("photo-1517245386807-bb43f82c33c4", 800, 600),
] as const;

export const DUMMY_PROJECT_IMAGES = [
  photo("photo-1487058792275-0ad4aaf24ca7", 900, 1100),
  photo("photo-1607252650355-f7fd0460ccdb", 900, 1100),
  photo("photo-1531482615713-2afd69097998", 900, 1100),
] as const;

export const DUMMY_TEAM_IMAGES = [
  photo("photo-1500648767791-00dcc994a43e", 600, 700),
  photo("photo-1494790108377-be9c29b29330", 600, 700),
  photo("photo-1519345182560-3f2917c472ef", 600, 700),
  photo("photo-1527980965255-d3b416303d12", 600, 700),
] as const;

export const DUMMY_BLOG_IMAGES = [
  photo("photo-1551434678-e076c223a692", 900, 600),
  photo("photo-1600880292203-757bb62b4baf", 900, 600),
  photo("photo-1519389950473-47ba0277781c", 900, 600),
] as const;

export const DUMMY_AVATAR_IMAGES = [
  photo("photo-1500648767791-00dcc994a43e", 200, 200),
  photo("photo-1494790108377-be9c29b29330", 200, 200),
] as const;

/** Listeden sıra numarasına göre deterministik yer tutucu seçer. */
export function dummyImage(list: readonly string[], index: number): string {
  return list[index % list.length]!;
}
