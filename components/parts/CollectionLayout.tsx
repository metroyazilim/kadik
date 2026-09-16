import type { ReactNode } from "react";

export type CollectionLayoutMode = "grid" | "carousel";
export type CollectionColumns = 2 | 3 | 4;

/** Etkin sütun sayısı kart sayısını asla aşmaz: 3 sütunluk bir bölümde iki
 * kart varsa iki kart satırı eşit paylaşır, sağda boş sütun kalmaz. */
const GRID_COLS: Record<CollectionColumns, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

const CAROUSEL_BASIS: Record<CollectionColumns, string> = {
  2: "basis-[85%] sm:basis-[48%]",
  3: "basis-[85%] sm:basis-[48%] lg:basis-[32%]",
  4: "basis-[85%] sm:basis-[48%] lg:basis-[24%]",
};

function effectiveColumns(columns: CollectionColumns, count: number | undefined): CollectionColumns {
  if (!count || count >= columns) return columns;
  return count <= 2 ? 2 : (count as CollectionColumns);
}

/**
 * Her koleksiyon bölümünün (hizmet, proje, ekip, blog) kartlarını çizdiği tek
 * yerleşim primitifi. `auto-rows-fr` + `items-stretch` ile satırdaki tüm
 * kartlar aynı yükseklikte olur; kart bileşenleri `h-full flex flex-col`
 * kullanarak bu yüksekliği doldurur. `carousel` saf CSS scroll-snap satırıdır.
 */
export function CollectionLayout({
  mode,
  columns,
  count,
  children,
}: {
  mode: CollectionLayoutMode;
  columns: CollectionColumns;
  /** Kart sayısı: sütun sayısını buna göre daraltır. */
  count?: number;
  children: ReactNode;
}) {
  const cols = effectiveColumns(columns, count);

  if (mode === "carousel") {
    return (
      <div className="-mx-[15px] mt-14 overflow-x-auto px-[15px] pb-4 [scrollbar-width:thin]">
        <div className="flex snap-x snap-mandatory items-stretch gap-7">
          <CarouselSlides columns={cols}>{children}</CarouselSlides>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-14 grid auto-rows-fr items-stretch gap-7 ${GRID_COLS[cols]}`}>{children}</div>
  );
}

function CarouselSlides({ columns, children }: { columns: CollectionColumns; children: ReactNode }) {
  return (
    <>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <div key={index} className={`shrink-0 snap-start ${CAROUSEL_BASIS[columns]}`}>
              {child}
            </div>
          ))
        : (
            <div className={`shrink-0 snap-start ${CAROUSEL_BASIS[columns]}`}>{children}</div>
          )}
    </>
  );
}
