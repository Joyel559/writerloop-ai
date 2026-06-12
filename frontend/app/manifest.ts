import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WriterLoop AI",
    short_name: "WriterLoop",
    description: "Intelligent feedback loops for better writing.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f8f9",
    theme_color: "#157a6e",
    icons: [
      {
        src: "/icon-192.svg",
        type: "image/svg+xml",
        sizes: "192x192"
      },
      {
        src: "/icon-512.svg",
        type: "image/svg+xml",
        sizes: "512x512"
      }
    ]
  };
}
