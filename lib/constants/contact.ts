/**
 * The foundation's contact address, in one place.
 *
 * Mobile keeps the same single constant (`src/constants/contact.tsx:2`) and
 * shows it in two places: the "no groups to suggest" empty state and the legacy
 * recommended-groups screen, both with a Copy Mail button. Web showed a dead-end
 * message instead, so a member with nothing to join had no way to ask for a
 * group.
 *
 * Not an i18n string: it is an address, not copy — translating it would break
 * it, and two surfaces drifting apart on the literal is the failure this
 * prevents.
 */
export const BMCF_CONTACT_EMAIL = "cancerbuddy@bonemarrow.org";

/**
 * The foundation's website — mobile's `BONE_MARROW_WEBSITE`.
 *
 * Used as the fallback share target when Contentful has no app-store link, so
 * "share the app" always sends somebody somewhere real.
 */
export const BMCF_WEBSITE_URL = "https://bonemarrow.org/";
