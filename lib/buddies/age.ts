/**
 * Age-bracket rules — a faithful port of the mobile app's `src/utils/birth.ts`.
 *
 * These functions decide **who a user is allowed to see at all**, so they are
 * safety logic, not formatting helpers: adults only ever match adults, teens
 * only teens, and so on. The mobile version is built on `moment` + `sugar`;
 * this one is dependency-free but produces byte-identical `YYYY-MM-DD` bounds,
 * because the resulting strings are fed straight into AppSync
 * `birth: { between: [...] }` filters and must agree with what mobile sends.
 */

export const MAXIMUM_AGE = 130;
export const MAXAGE = 18;
export const MINAGE = 13;
export const INFANTILE_AGE = 7;
export const CERO_AGE = 0;
export const UNIVERSITY_AGE = 17;

/** `sugar`'s `Number(n).yearAgo().format('{yyyy}-{MM}-{dd}')`. */
function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Birth dates arrive in three shapes across the platform: `MM/YYYY` (what the
 * signup form writes), `YYYY-MM-DD` (what most rows store), and full ISO. Mobile
 * tries them in that order via `moment(value, fmt, true)`; so do we.
 */
function parseBirth(value: string): Date | null {
  const s = value.trim();
  if (!s) return null;

  const mmYyyy = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (mmYyyy) {
    const month = Number(mmYyyy[1]) - 1;
    if (month < 0 || month > 11) return null;
    return new Date(Number(mmYyyy[2]), month, 1);
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Whole years elapsed since `dateString`; 0 when unparseable (as on mobile). */
export function displayAge(dateString?: string | null): number {
  const birth = parseBirth(dateString ?? "");
  if (!birth) return 0;

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return years > 0 ? years : 0;
}

/** `", 34"` — the age suffix next to a name. Empty for HOST/SUPPORT accounts. */
export function ageSuffix(userType: string, birth?: string | null): string {
  if (userType === "HOST" || userType === "SUPPORT") return "";
  const age = displayAge(birth);
  return age > 0 ? `, ${age}` : "";
}

export interface AgeRange {
  min: string;
  max: string;
}

/**
 * The `[from, to]` birth-date window a user is allowed to search within.
 *
 * Without `ranges` this is the plain age-bracket guard (adults see adults,
 * teens see teens, …). With `ranges` the requested min/max is *clamped* into
 * the caller's own bracket, so a 30-year-old asking for "13 to 20" still only
 * ever gets 18+ results.
 *
 * Returns the JSON array literal AppSync expects, e.g. `["1895-… ","2007-… "]`.
 */
export function birthRules(
  birth?: string | null,
  ranges?: AgeRange,
): string | undefined {
  const currentAge = displayAge(birth);
  const date130years = yearsAgo(MAXIMUM_AGE);
  const date18years = yearsAgo(MAXAGE);
  const date14years = yearsAgo(MINAGE);
  const date7years = yearsAgo(INFANTILE_AGE);
  const date0years = yearsAgo(CERO_AGE);

  if (!ranges) {
    if (currentAge >= 18) return JSON.stringify([date130years, date18years]);
    if (currentAge >= 14 && currentAge < 18)
      return JSON.stringify([date18years, date14years]);
    if (currentAge > 7 && currentAge < 14)
      return JSON.stringify([date14years, date7years]);
    if (currentAge <= 7) return JSON.stringify([date7years, date0years]);
  }

  const minRange = ranges?.min && ranges.min !== "" ? Number(ranges.min) : 0;
  const maxRange = ranges?.max && ranges.max !== "" ? Number(ranges.max) : 130;
  const minDate = yearsAgo(minRange);
  const maxDate = yearsAgo(maxRange + 1);

  if (currentAge >= 18) {
    const lowerBoundIsUserRange =
      minRange >= MAXAGE && minRange <= maxRange ? minDate : date18years;
    const upperBoundIsUserRange = maxRange >= MAXAGE ? maxDate : date130years;

    if (minRange === maxRange) {
      if (maxRange < MAXAGE && minRange < MAXAGE) {
        return JSON.stringify([yearsAgo(MAXAGE + 1), date18years]);
      }
      return JSON.stringify([yearsAgo(maxRange + 1), minDate]);
    }
    return JSON.stringify([upperBoundIsUserRange, lowerBoundIsUserRange]);
  }

  if (currentAge >= 14 && currentAge < 18) {
    const upper =
      maxRange < MAXAGE && maxRange >= MINAGE ? maxDate : date18years;
    const lower =
      minRange >= MINAGE && minRange < MAXAGE ? minDate : date14years;
    return JSON.stringify([upper, lower]);
  }

  if (currentAge > 7 && currentAge < 14) {
    const upper =
      maxRange < MINAGE && maxRange >= minRange ? maxDate : date14years;
    const lower =
      minRange >= INFANTILE_AGE && minRange <= maxRange ? minDate : date7years;
    return JSON.stringify([upper, lower]);
  }

  // currentAge <= 7 — unreachable from the UI (the age inputs only render for
  // 18+), kept for parity with mobile.
  const upper = maxRange <= INFANTILE_AGE ? maxDate : date7years;
  const lower =
    minRange >= CERO_AGE && minRange <= maxRange ? minDate : date0years;
  return JSON.stringify([upper, lower]);
}

/** Birth window for the *patient* a caregiver looks after. */
export function patientBirthRules(ranges: AgeRange): string {
  const min = ranges?.min && ranges.min !== "" ? Number(ranges.min) : CERO_AGE;
  const max = ranges?.max && ranges.max !== "" ? Number(ranges.max) : MAXIMUM_AGE;

  if (min === max) {
    return JSON.stringify([yearsAgo(min + 1), yearsAgo(max)]);
  }
  return JSON.stringify([yearsAgo(max), yearsAgo(min)]);
}

/**
 * Whether two people are allowed to connect when found by Buddy ID / QR — a
 * looser rule than the browse guard: any two 13+ users may connect, but a child
 * can only reach another child.
 */
export function connectAgeRulesBuddySearching(
  userBirth?: string | null,
  connectBirth?: string | null,
): boolean {
  const first = displayAge(userBirth);
  const second = displayAge(connectBirth);
  if (first >= MAXAGE && second >= MAXAGE) return true;
  if (first >= MINAGE && second >= MINAGE) return true;
  if (
    first < MINAGE &&
    second < MINAGE &&
    first >= INFANTILE_AGE &&
    second >= INFANTILE_AGE
  ) {
    return true;
  }
  return false;
}

/** `MM/YYYY` → `YYYY-MM-DD` for the `inRemissionSince: { ge: … }` filter. */
export function remissionSinceToIsoDate(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  return `${m[2]}-${String(month).padStart(2, "0")}-01`;
}

/** `2019-04-01` → `04/2019`, the format the profile card shows. */
export function formatRemissionDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit" });
}
