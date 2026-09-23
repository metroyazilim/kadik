import type { MetadataRoute } from "next";

/** Web app manifest: install name, colours and the KADİK icon (app/icon.png). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KADİK London - Kybele Atasever World Business Council",
    short_name: "KADİK",
    description: "A London-based world business council connecting entrepreneurs, executives and sectors.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#07285f",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
