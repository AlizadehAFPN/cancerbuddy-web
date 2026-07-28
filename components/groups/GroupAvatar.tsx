/**
 * Square-ish group avatar with an optional verified check, matching the mobile
 * group rows. Groups use a rounded square so they read as distinct from the
 * circular people avatars elsewhere in the app.
 */

import { initials } from "@/lib/buddies/display";

export default function GroupAvatar({
  name,
  imageUrl,
  verified,
  size = 48,
}: {
  name: string;
  imageUrl?: string;
  verified?: boolean;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full rounded-2xl bg-cb-gray-100 object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-2xl bg-cb-bone font-heading font-bold text-cb-black"
          style={{ fontSize: size * 0.34 }}
        >
          {initials(name)}
        </div>
      )}

      {verified && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-white bg-cb-yellow text-cb-black"
          style={{ width: size * 0.36, height: size * 0.36 }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: "62%", height: "62%" }}
          >
            <path d="m20 6-11 11-5-5" />
          </svg>
        </span>
      )}
    </div>
  );
}
