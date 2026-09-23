import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublishedPostByRoute } from "@/lib/public-content/post";

/**
 * Share card for a news article: the KADİK brand card (white logo on the
 * brand blue, `public/kadik/og/post-background.png`, built by
 * `scripts/og/generate-og-images.py`) with the article title on top.
 */
export const alt = "KADİK London news";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, background, serif] = await Promise.all([
    getPublishedPostByRoute("en", slug).catch(() => null),
    readFile(join(process.cwd(), "public/kadik/og/post-background.png")),
    readFile(join(process.cwd(), "assets/fonts/LiberationSerif-Bold.ttf")),
  ]);
  const title = post?.title ?? "News from the council";
  const meta = post
    ? [post.category, post.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })].filter(Boolean).join(" · ")
    : "KADİK London";
  const fontSize = title.length > 90 ? 44 : title.length > 60 ? 52 : 60;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <img src={`data:image/png;base64,${background.toString("base64")}`} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", left: 72, right: 300, top: 240, bottom: 60, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", color: "#ffffff", fontFamily: "KadikSerif", fontSize, lineHeight: 1.12 }}>{title}</div>
          <div style={{ display: "flex", color: "#dce5f3", fontSize: 24, letterSpacing: 1 }}>{meta.toUpperCase()}</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "KadikSerif", data: serif, style: "normal", weight: 700 }] },
  );
}
