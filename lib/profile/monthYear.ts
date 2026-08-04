/**
 * `MM/YYYY` handling for the birth and remission fields.
 *
 * The app never asks for a day — only a month and year — but the backend stores
 * a full date. Mobile resolves that by saving the **last day of the month**
 * (`utils/birth.ts` `birthDate`), which matters for age maths: someone born in
 * March 2000 doesn't count as a year older until April. The same convention is
 * used here so an age computed on the web matches the phone.
 */

/** Longest lifespan the forms accept, matching mobile's `MAX_DIFF_YEARS`. */
const MAX_AGE_YEARS = 130;

export type MonthYearError =
  | "incomplete"
  | "invalid"
  | "future"
  | "too-old"
  | null;

/** Progressive formatting as the user types: `032024` → `03/2024`. */
export function formatMonthYearInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 6);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/**
 * Validates a `MM/YYYY` string using the same rules as mobile's `isValidDate`.
 * An empty value is *not* an error here — required-ness is the caller's call.
 */
export function validateMonthYear(value: string): MonthYearError {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length < 7) return "incomplete";

  const match = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (!match) return "invalid";

  const month = Number(match[1]);
  const year = Number(match[2]);
  if (Number.isNaN(month) || month < 1 || month > 12) return "invalid";
  if (Number.isNaN(year)) return "invalid";

  const currentYear = new Date().getFullYear();
  if (year > currentYear) return "future";
  if (currentYear - year > MAX_AGE_YEARS) return "too-old";

  return null;
}

/**
 * `MM/YYYY` → ISO date on the **last day** of that month, which is what mobile
 * writes. Returns null when the value isn't a complete, valid month/year.
 */
export function monthYearToStoredDate(value: string): string | null {
  if (validateMonthYear(value) !== null) return null;
  const match = value.trim().match(/^(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const year = Number(match[2]);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Stored ISO date → `MM/YYYY` for the input. */
export function storedDateToMonthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = iso.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[2]}/${match[1]}`;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
