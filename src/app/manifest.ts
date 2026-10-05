import type { MetadataRoute } from "next";
import { STORE } from "@/lib/store";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: STORE.name,
    short_name: STORE.shortName,
    description: `Order from ${STORE.name} on your phone.`,
    start_url: "/",
    display: "standalone",
    background_color: "#f6eee1",
    theme_color: "#f6eee1",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
