/**
 * Normalizes thrown values from Cognito, AppSync/fetch, and plain `Error`
 * into a single string safe to show in the UI.
 *
 * Does not log or mutate — callers decide fallback copy and analytics.
 */
export function userFacingErrorMessage(
  err: unknown,
  fallback: string,
): string {
  const fb = fallback.trim() || "Something went wrong. Please try again.";

  if (err == null) return fb;

  if (typeof err === "string") {
    const s = err.trim();
    return s || fb;
  }

  if (err instanceof Error) {
    const s = err.message?.trim();
    if (s) return s;
    return fb;
  }

  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) {
      return o.message.trim();
    }
    /** Some AWS / Amplify errors nest another error */
    const underlying = o.underlyingError ?? o.cause;
    if (underlying) {
      return userFacingErrorMessage(underlying, fb);
    }
  }

  return fb;
}
