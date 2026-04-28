import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* ── Brand fonts (sourced from the CancerBuddy mobile app) ── */

const sharpGrotesque = localFont({
  src: [
    {
      path: "../public/fonts/SharpGroteskBook20.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/SharpGroteskMedium20.ttf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-sharp-grotesque",
  display: "swap",
});

const haasGrot = localFont({
  src: [
    {
      path: "../public/fonts/HaasGrotDispApp-55Roman.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/HaasGrotDispApp-75Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-haas-grot",
  display: "swap",
});

/* ── Metadata ── */

export const metadata: Metadata = {
  title: {
    default: "CancerBuddy",
    template: "%s | CancerBuddy",
  },
  description:
    "Connect with others on your cancer journey. Peer support for patients, caregivers, and survivors.",
  metadataBase: new URL("https://cancerbuddy.com"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/* ── Root layout ── */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sharpGrotesque.variable} ${haasGrot.variable} h-full antialiased`}
    >
      <body className="flex flex-col min-h-full font-body bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
