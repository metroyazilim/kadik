/** Client-safe shapes of the KADİK collections as the public site renders them. */

export type KadikEventView = Readonly<{
  id: string;
  title: string;
  /** `YYYY-MM-DD` */
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  /** Sanitised HTML; `null` when empty. */
  descriptionHtml: string | null;
  image: string | null;
  registrationUrl: string | null;
}>;

export type KadikAnnouncementView = Readonly<{
  id: string;
  title: string;
  text: string;
  date: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
}>;

export type KadikGalleryItemView = Readonly<{
  id: string;
  image: string;
  category: string;
  caption: string;
}>;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
