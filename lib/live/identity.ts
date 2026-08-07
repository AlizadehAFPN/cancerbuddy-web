/**
 * Twilio participant identities.
 *
 * The token Lambda mints identities as `"<userId>::<displayName>"` (older
 * sessions used `"<userId>|<displayName>"`). Both halves matter: the id is what
 * host checks and moderation are keyed on, the name is what a tile shows. This
 * is the exact parser the mobile room uses — `cancerbuddyapp`
 * `useTwilioRoom.ts` — and the two must agree or a host would look like a
 * regular participant on one platform and not the other.
 */

export interface ParsedIdentity {
  userId: string;
  displayName: string;
}

export function parseIdentity(identity: string): ParsedIdentity {
  let index = identity.indexOf("::");
  if (index !== -1) {
    return {
      userId: identity.slice(0, index),
      displayName: identity.slice(index + 2),
    };
  }
  index = identity.indexOf("|");
  if (index !== -1) {
    return {
      userId: identity.slice(0, index),
      displayName: identity.slice(index + 1),
    };
  }
  /* No separator: the whole string is both. */
  return { userId: identity, displayName: identity };
}

/** Tiles show a first name — full names don't fit and read as clutter. */
export function firstNameOf(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0];
  return first || displayName;
}

/** Up to two initials, for the avatar shown when a camera is off. */
export function initialsOf(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return initials || "?";
}
