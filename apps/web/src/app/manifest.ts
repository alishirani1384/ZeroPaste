import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZeroPaste",
    short_name: "ZeroPaste",
    description: "Your clipboard, supercharged and secure.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f8",
    theme_color: "#E85D4C",
    icons: [
      {
        src: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
