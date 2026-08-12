import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Huddle UMD",
    short_name: "Huddle",
    description: "A phone-first activity RSVP app for UMD students to meet in small public groups.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#07080d",
    theme_color: "#07080d",
    orientation: "portrait",
    categories: ["social", "education", "lifestyle"],
    icons: [
      {
        src: "/icons/huddle-app-v1-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/huddle-app-maskable-v1-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/huddle-app-v1-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/huddle-app-maskable-v1-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
