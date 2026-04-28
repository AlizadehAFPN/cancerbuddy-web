import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Tell us what's going on and we'll get back to you.",
  robots: { index: false, follow: false },
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
