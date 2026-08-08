import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { loginSchema } from "@/lib/validations";
import { checkPassword, credentialsSchema } from "./validation";

/**
 * Acceptance checks for `password-meter-missing-special-char-rule` and the
 * password half of `login-short-password-and-resume-orientation`, WORKLIST Phase 0.
 */

const CANDIDATES = [
  "abc", // too short, nothing else
  "abcdefgh", // length + lowercase only
  "Abcdefgh", // + uppercase
  "Abcdefg1", // + number — the case that used to show all-green
  "Abcdefg1!", // every rule
  "ABCDEFG1!", // no lowercase
  "abcdefg1!", // no uppercase
  "Abcdefgh!", // no number
  "Abc1!", // every character class but too short
  "A1!aaaaaaaaaaaaaaaa", // long and complete
];

describe("checkPassword agrees with credentialsSchema", () => {
  /**
   * The invariant that matters: an all-green meter must mean the form accepts it.
   * The meter checked four rules while the schema enforced five, so `Abcdefg1`
   * filled every segment and was then rejected on submit.
   */
  it.each(CANDIDATES)("matches the schema verdict for %j", (password) => {
    const meterSaysStrong = Object.values(checkPassword(password)).every(Boolean);
    const schemaAccepts = credentialsSchema.safeParse({
      email: "a@b.co",
      password,
      confirmPassword: password,
    }).success;
    expect(meterSaysStrong).toBe(schemaAccepts);
  });

  /** Named explicitly because it is the regression this item exists for. */
  it("does not call Abcdefg1 strong", () => {
    expect(checkPassword("Abcdefg1").special).toBe(false);
    expect(Object.values(checkPassword("Abcdefg1")).every(Boolean)).toBe(false);
  });

  it("checks a rule for every key the meter renders", () => {
    expect(Object.keys(checkPassword("x")).sort()).toEqual([
      "lowercase",
      "minLength",
      "number",
      "special",
      "uppercase",
    ]);
  });
});

describe("resume orientation", () => {
  /**
   * The login page must carry a reason with the redirect, and /register must
   * render it. Source assertions because both are client components inside
   * providers; the DOM half is the Playwright check in the worklist.
   */
  it("carries a resumed marker on both resume redirects", () => {
    const login = readFileSync("app/(auth)/login/page.tsx", "utf8");
    expect(login).toContain("/register?step=phone&resumed=1");
    expect(login).toContain("/register?step=userRole&resumed=1");
  });

  it("explains the redirect on /register", () => {
    const register = readFileSync("app/register/page.tsx", "utf8");
    expect(register).toMatch(/searchParams\.get\("resumed"\) === "1"/);
    expect(register).toContain('t("register.enrollmentIncomplete")');
  });
});

describe("loginSchema accepts legacy passwords", () => {
  /** Cognito is the authority; the form must let the request through. */
  it("accepts a password shorter than the signup minimum", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "abc123" }).success,
    ).toBe(true);
  });

  it("still rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(
      false,
    );
  });

  it("still validates the email", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "abc123" }).success,
    ).toBe(false);
  });
});
