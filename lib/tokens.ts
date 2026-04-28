/**
 * CancerBuddy design tokens — single source of truth.
 *
 * These values mirror the mobile app's color palette exactly.
 * Tailwind utility classes (bg-cb-*, text-cb-*, etc.) are generated from
 * the matching @theme block in globals.css. Use these constants wherever you
 * need the raw hex value (canvas draws, inline styles, non-Tailwind contexts).
 */

export const colors = {
  /* Primary */
  yellow:      "#FEE948",
  yellow600:   "#DAC534",
  yellow700:   "#B6A224",
  yellow800:   "#79680D",
  black:       "#242424",
  white:       "#ffffff",

  /* Secondary */
  bone:        "#FEF9CA",
  bone300:     "#FEFCDF",
  purple:      "#DBC9FA",
  blue:        "#A1E8FF",
  green:       "#5BE660",

  /* Neutral */
  gray100:     "#F2F2F2",
  gray200:     "#E5E5E5",
  gray300:     "#CCCCCC",
  gray400:     "#B2B2B2",
  gray500:     "#929292",
  gray600:     "#737373",
  gray700:     "#505050",
  gray800:     "#3A3A3A",

  /* Semantic */
  danger:      "#FF5977",
  success:     "#83E86D",
  info:        "#7986FC",
  warning:     "#FCDC0C",
} as const;

export type ColorKey = keyof typeof colors;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  "2xl": 48,
  "3xl": 64,
} as const;

export const radii = {
  sm:   4,
  md:   8,
  lg:   16,
  full: 9999,
} as const;

export const fontSizes = {
  xs:   12,
  sm:   14,
  base: 16,
  lg:   18,
  xl:   20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;
