import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trace",
    short_name: "Trace",
    description: "Every requirement, traced. A workspace for student software teams.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0c0c0a",
    theme_color: "#0c0c0a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
