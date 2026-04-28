import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex flex-col flex-1 min-h-dvh items-center justify-center gap-6 p-8 text-center bg-cb-yellow">
      <span
        className="font-heading font-bold text-cb-black"
        style={{ fontSize: "5rem", lineHeight: 1 }}
      >
        404
      </span>
      <p className="font-heading text-xl text-cb-black max-w-[280px]">
        We couldn&apos;t find that page.
      </p>
      <Link
        href="/"
        className={[
          "inline-flex items-center justify-center h-12 px-8 rounded-full",
          "font-heading font-medium text-base",
          "bg-cb-black text-white",
          "transition-colors hover:bg-cb-gray-800 active:bg-cb-gray-700",
        ].join(" ")}
      >
        Go home
      </Link>
    </div>
  );
}
