/**
 * Round avatar with the optional "goal" badge overlaid bottom-right, matching
 * the mobile avatar. Plain <img> on purpose: S3 serves signed URLs on hosts
 * next/image would have to be allow-listed for.
 */

import { initials } from "@/lib/buddies/display";

export default function BuddyAvatar({
  name,
  photoUrl,
  goalUrl,
  size = 56,
}: {
  name: string;
  photoUrl?: string;
  goalUrl?: string;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full rounded-full bg-cb-gray-100 object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full bg-cb-yellow font-heading font-semibold text-cb-black"
          style={{ fontSize: size * 0.36 }}
        >
          {initials(name)}
        </div>
      )}

      {goalUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={goalUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white bg-white object-cover"
          style={{ width: size * 0.38, height: size * 0.38 }}
        />
      )}
    </div>
  );
}
