/**
 * Shared line icons.
 *
 * A local set rather than an icon package: these are the handful of shapes the
 * app actually uses, they inherit `currentColor`, and they add nothing to the
 * bundle beyond the markup itself.
 */

import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
);

export const XIcon = ({ size = 16, className }: IconProps) =>
  svg(size, className, <path d="M18 6 6 18M6 6l12 12" />);

export const SearchIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </>,
  );

export const CheckIcon = ({ size = 16, className }: IconProps) =>
  svg(size, className, <path d="m20 6-11 11-5-5" />);

export const ChevronRightIcon = ({ size = 16, className }: IconProps) =>
  svg(size, className, <path d="m9 18 6-6-6-6" />);

export const ChevronDownIcon = ({ size = 16, className }: IconProps) =>
  svg(size, className, <path d="m6 9 6 6 6-6" />);

export const ArrowLeftIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>,
  );

export const NoteIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M15 2v5h5M8 13h8M8 17h5" />
    </>,
  );

export const MapPinIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>,
  );

export const SlidersIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>,
  );

export const IdCardIcon = ({ size = 20, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5 16c.7-1.4 2-2 3.5-2s2.8.6 3.5 2M15 10h4M15 14h4" />
    </>,
  );

export const UserPlusIcon = ({ size = 18, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M15 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>,
  );

export const RefreshIcon = ({ size = 16, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </>,
  );

