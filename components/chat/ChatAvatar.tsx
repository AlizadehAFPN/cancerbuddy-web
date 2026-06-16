import { initials } from "@/lib/chat/helpers";

/**
 * Round avatar — shows the user's photo when available, otherwise brand-colored
 * initials. An optional `icon` (the contact's goal image) is overlaid bottom-
 * right, mirroring the mobile avatar. Plain <img> on purpose (Stream/S3 serve
 * arbitrary CDN hosts that next/image would need all-listed).
 */
export default function ChatAvatar({
  name,
  image,
  icon,
  size = 44,
}: {
  name: string;
  image?: string;
  icon?: string;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full bg-cb-yellow font-heading font-semibold text-cb-black"
          style={{ fontSize: size * 0.4 }}
        >
          {initials(name)}
        </div>
      )}

      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white bg-white object-cover"
          style={{ width: size * 0.4, height: size * 0.4 }}
        />
      )}
    </div>
  );
}
