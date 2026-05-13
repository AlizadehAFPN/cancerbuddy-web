import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register as a Host",
  description:
    "Apply to become a CancerBuddy host. Guide newcomers, share what you've learned, and offer real peer support to people navigating a cancer journey.",
  robots: { index: false, follow: true },
};

export default function HostsRegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
