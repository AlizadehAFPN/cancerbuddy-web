/**
 * The identity line under your own name on the profile hub.
 *
 * Mobile prints three facts there (`AvatarProfile.tsx` → `AvatarInfoLayout`):
 * your age beside your name, your city and state, and your pronouns. Web
 * fetched all three — `birth`, `City`, `State`, `Pronoun` are all in the hub's
 * query — and rendered none of them, so your own profile told you less about
 * yourself than a stranger's told you about them.
 *
 * Pure, and the helpers are injected, so the rule can be asserted without a
 * React tree: what belongs on the line, in what order, and what is suppressed.
 */

export interface IdentityFactsUser {
  birth?: string | null;
  userType?: string | null;
  city?: { name?: string | null } | null;
  state?: { name?: string | null; stateAbbreviation?: string | null } | null;
  pronoun?: { name?: string | null } | null;
}

/**
 * Stored like any other pronoun, never displayed. The buddy profile suppresses
 * the same string (`lib/buddies/profileDetail.ts:227-231`); repeating the rule
 * here rather than exporting it from there keeps the two surfaces honest about
 * agreeing — a shared helper that quietly changed would change both at once.
 */
const UNDISCLOSED_PRONOUN = "I rather not disclose";

export function identityFactsFor(
  user: IdentityFactsUser | null | undefined,
  helpers: {
    /** `", 34"` — the suffix form, because it is shared with the name line. */
    ageSuffix: (userType: string, birth?: string | null) => string;
    formatLocation: (city?: string | null, stateAbbreviation?: string | null) => string;
  },
): string[] {
  if (!user) return [];

  const facts: string[] = [];

  // `ageSuffix` returns ", 34" and is empty for HOST / SUPPORT accounts, which
  // is exactly mobile's rule — an age is a member fact, not a staff one.
  const age = helpers.ageSuffix(user.userType ?? "", user.birth).replace(/^,\s*/, "");
  if (age) facts.push(age);

  const location = helpers.formatLocation(
    user.city?.name,
    user.state?.stateAbbreviation,
  );
  if (location) facts.push(location);

  const pronoun = (user.pronoun?.name ?? "").trim();
  if (pronoun && pronoun !== UNDISCLOSED_PRONOUN) facts.push(pronoun);

  return facts;
}
