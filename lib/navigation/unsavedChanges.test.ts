import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FORMS = [
  "components/profile/PersonalInfoForm.tsx",
  "components/profile/MedicalInfoForm.tsx",
  "components/profile/PatientInfoForm.tsx",
  "components/profile/InterestsForm.tsx",
];

/** Acceptance check for `unsaved-changes-guard`, WORKLIST Phase 1. */
describe("every profile form reports to the provider", () => {
  it.each(FORMS)("%s uses useDirtyForm instead of a bare beforeunload", (path) => {
    const code = stripComments(readFileSync(path, "utf8"));
    expect(code).toMatch(/useDirtyForm\(dirty\)/);
    // The listener that never fired on client-side navigation is gone.
    expect(code).not.toMatch(/addEventListener\("beforeunload"/);
  });

  it.each(FORMS)("%s guards its back arrow", (path) => {
    const code = stripComments(readFileSync(path, "utf8"));
    expect(code).toMatch(/guardedPush\("\/profile"\)/);
    expect(code).not.toMatch(/router\.push\("\/profile"\)/);
  });
});

describe("the three ways out of a form are all intercepted", () => {
  const provider = stripComments(
    readFileSync("lib/navigation/UnsavedChangesProvider.tsx", "utf8"),
  );

  /** In-app links, via Next's synchronous `onNavigate`. */
  it("intercepts link navigation", () => {
    const link = stripComments(
      readFileSync("components/navigation/GuardedLink.tsx", "utf8"),
    );
    expect(link).toMatch(/onNavigate=\{/);
    expect(link).toMatch(/interceptNavigation\(/);
    expect(link).toMatch(/e\.preventDefault\(\)/);
  });

  /** Programmatic pushes, which can await the answer. */
  it("offers an awaitable guardedPush", () => {
    expect(provider).toMatch(/const guardedPush = useCallback\(/);
    expect(provider).toMatch(/const leave = await confirmLeave\(\)/);
  });

  /** Browser back, via a history sentinel. */
  it("arms a history sentinel while dirty and re-arms it on stay", () => {
    expect(provider).toMatch(/window\.history\.pushState/);
    expect(provider).toMatch(/addEventListener\("popstate"/);
    // Pushed twice: once to arm, once to re-arm after the dialog.
    expect(provider.match(/window\.history\.pushState/g)?.length).toBe(2);
  });

  /** Refresh and tab close, which no in-app interception can reach. */
  it("keeps beforeunload for the cases navigation cannot cover", () => {
    expect(provider).toMatch(/addEventListener\("beforeunload"/);
  });

  it("resolves the promise when there is one, and re-issues the route otherwise", () => {
    expect(provider).toMatch(/if \(resolve\) \{/);
    expect(provider).toMatch(/if \(href\) router\.push\(href\);/);
    expect(provider).toMatch(/else router\.back\(\);/);
  });

  /** A clean form must not stop anyone. */
  it("short-circuits when nothing is dirty", () => {
    expect(provider).toMatch(/if \(!dirtyRef\.current\) return true;/);
    expect(provider).toMatch(/if \(!dirtyRef\.current\) return false;/);
  });
});

describe("the shell links are guarded", () => {
  it.each([
    "components/app-shell/Sidebar.tsx",
    "components/app-shell/BottomBar.tsx",
    "components/app-shell/AccountSheet.tsx",
  ])("%s routes through GuardedLink", (path) => {
    const code = stripComments(readFileSync(path, "utf8"));
    expect(code).toMatch(/from "@\/components\/navigation\/GuardedLink"/);
    expect(code).not.toMatch(/from "next\/link"/);
  });

  it("the provider is mounted above the shell", () => {
    const layout = readFileSync("app/(app)/layout.tsx", "utf8");
    expect(layout).toMatch(/<UnsavedChangesProvider>/);
  });
});
