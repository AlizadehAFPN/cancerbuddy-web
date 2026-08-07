import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";

/**
 * Web app manifest — served at `/manifest.webmanifest`.
 *
 * Present for web push, not for an offline story: iOS 16.4+ only delivers push
 * to a site that has been installed to the home screen, and installation
 * requires a valid manifest served over HTTPS. Desktop Chrome/Edge/Firefox push
 * works without it.
 *
 * `start_url` is "/" rather than "/groups" (the app home) because an installed
 * icon may be opened by a logged-out member; AuthGuard routes from there.
 *
 * The icons are rendered from `public/images/BMCF_LOGO_SQUARE.svg`, which is the
 * foundation's full lockup — legible at 512 but not at the 48px the OS uses for
 * a notification badge. A purpose-drawn maskable mark is a design follow-up.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t("metadata.rootDefaultTitle"),
    short_name: "CancerBuddy",
    description: t("metadata.rootDescription"),
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    /* --color-cb-yellow, the brand primary (app/globals.css). */
    theme_color: "#FEE948",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
