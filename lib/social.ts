// Metro Yazılım'ın gerçek sosyal hesapları. Tek kayıt: üst şerit ve footer
// aynı listeyi okur, ikisinde farklı bağlantı kalamaz. Hesabı olmayan ağ
// (ör. Facebook) burada yer almaz - boş `#` bağlantısı yayınlanmaz.
export type SocialNetwork = "youtube" | "linkedin" | "x";

export const SOCIAL_LINKS: ReadonlyArray<Readonly<{ network: SocialNetwork; label: string; url: string }>> = [
  { network: "youtube", label: "YouTube", url: "https://www.youtube.com/@metroyazilim" },
  { network: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/metro-yazilim" },
  { network: "x", label: "X", url: "https://x.com/metroyazilim" },
];
