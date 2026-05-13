/**
 * Wizard "Back" targets when the URL or UI can skip steps (e.g. resume signup).
 * `resolve(whenOn)` returns where the in-flow Back control should navigate.
 */

export function createStepBackResolver<T extends string>(
  fallbacks: Partial<Record<T, T>>,
) {
  const overrides = new Map<T, T>();

  return {
    /** Declare that while on `whenOn`, Back should go to `backTo` (not the default). */
    setOverride(whenOn: T, backTo: T): void {
      overrides.set(whenOn, backTo);
    },
    clearOverride(whenOn: T): void {
      overrides.delete(whenOn);
    },
    resolve(whenOn: T): T | undefined {
      const o = overrides.get(whenOn);
      if (o !== undefined) return o;
      return fallbacks[whenOn];
    },
  };
}

export type StepBackResolver<T extends string> = ReturnType<
  typeof createStepBackResolver<T>
>;
