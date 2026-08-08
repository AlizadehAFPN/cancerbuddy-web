import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("aws-amplify", () => ({
  Auth: {
    forgotPassword: vi.fn(),
    forgotPasswordSubmit: vi.fn(),
    resendSignUp: vi.fn(),
  },
}));
vi.mock("@/lib/aws/amplifyConfigure", () => ({
  ensureAmplifyConfigured: vi.fn(),
}));
vi.mock("@/lib/aws/raiseUserLambda", () => ({
  raiseUserLambda: vi.fn(),
}));

import { Auth } from "aws-amplify";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { runLoginBootstrap } from "@/lib/login/loginBootstrap";
import {
  sendResetCode,
  submitNewPassword,
} from "@/lib/password-reset/service";
import {
  resetEmailSchema,
  resetPasswordSchema,
} from "@/lib/password-reset/validation";
import { credentialsSchema } from "@/lib/signup/validation";
import {
  PROGRESS_STEPS,
  PROGRESS_TOTAL,
  hasProgress,
  progressFor,
} from "@/lib/user-signup/progress";
import { USER_FLOW_ORDER } from "@/lib/navigation/userStepGate";
import { USER_REGISTER_BACK_FALLBACK } from "@/lib/navigation/userRegisterBackTargets";
import {
  buddyIdGuard,
  evaluateBuddyIdMatch,
} from "@/lib/buddies/useBuddyIdLookup";

/**
 * Acceptance checks for WORKLIST Phase 7 — the auth and registration sweep.
 *
 * Where the worklist asks for Playwright there is still no browser project, so
 * the equivalent is asserted on the pure layer plus a source assertion on the
 * wiring. Each of those is called out where it happens.
 */

/** Source with comments stripped, or an assertion matches the prose. */
function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/* ── login-users-lambda-bootstrap ───────────────────────────────────────── */

describe("the login bootstrap", () => {
  beforeEach(() => {
    vi.mocked(raiseUserLambda).mockReset();
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-lambda";
  });

  it("sends mobile's verb and payload, once", async () => {
    vi.mocked(raiseUserLambda).mockResolvedValue("{}");

    await expect(runLoginBootstrap("cognito-sub-1")).resolves.toBe(true);

    expect(raiseUserLambda).toHaveBeenCalledTimes(1);
    const [verb, name, payload] = vi.mocked(raiseUserLambda).mock.calls[0]!;
    expect(verb).toBe(LambdaPayloadType.LOGIN);
    expect(verb).toBe("login");
    expect(name).toBe("users-lambda");
    expect(payload).toEqual({ userId: "cognito-sub-1", token: undefined });
  });

  /** A Cognito session already exists by then; stranding the member is worse. */
  it("does not fail the sign-in when the lambda is down", async () => {
    vi.mocked(raiseUserLambda).mockRejectedValue(new Error("boom"));
    await expect(runLoginBootstrap("cognito-sub-1")).resolves.toBe(false);
  });

  it("says nothing at all without a user id", async () => {
    await expect(runLoginBootstrap("  ")).resolves.toBe(false);
    expect(raiseUserLambda).not.toHaveBeenCalled();
  });

  /**
   * Stands in for the Playwright assertion. Mobile diverts anyone without a
   * `userType` into the signup stack and never reaches `LoginInLambdaUtil`
   * (`useAuth.ts:207-225`), so the resume branches must not fire it.
   */
  it("runs only for a member who is through onboarding", () => {
    const source = sourceOf("lib/login/cognitoLoginService.ts");
    expect(source).toMatch(
      /result\.status === "DONE"[\s\S]{0,120}runLoginBootstrap\(cognitoUserId\)/,
    );
  });
});

/* ── register-email-verification-resume-modal ───────────────────────────── */

describe("the resume-unconfirmed branch sends a code", () => {
  /**
   * Call *order* is the whole point — mobile sends and only then offers the
   * choice, so the member always holds a code less than a minute old.
   */
  it("awaits the send before returning RESUME_UNCONFIRMED, on both flows", () => {
    for (const path of [
      "lib/user-signup/cognitoUserSignupService.ts",
      "lib/host-signup/cognitoHostSignupService.ts",
    ]) {
      const source = sourceOf(path);
      expect(source).toMatch(
        /await sendConfirmationCode\(email\);\s*return \{ status: "RESUME_UNCONFIRMED"/,
      );
    }
  });

  /** Regression guard: the branch used to return having sent nothing. */
  it("no longer returns that status without sending", () => {
    const source = sourceOf("lib/user-signup/cognitoUserSignupService.ts");
    expect(source).not.toMatch(
      /UserNotConfirmedException"\) \{\s*return \{ status: "RESUME_UNCONFIRMED"/,
    );
  });

  /**
   * `resendEmailCode` existed unused while the branch that needed it sent
   * nothing. One `Auth.resendSignUp` per file is what stops that recurring.
   */
  it("gives both senders one definition, on both flows", () => {
    for (const path of [
      "lib/user-signup/cognitoUserSignupService.ts",
      "lib/host-signup/cognitoHostSignupService.ts",
    ]) {
      const source = sourceOf(path);
      expect(source.match(/Auth\.resendSignUp\(/g), path).toHaveLength(1);
      expect(source.match(/sendConfirmationCode\(/g)?.length, path).toBe(3);
    }
  });
});

/* ── register-progress-bar-scope ────────────────────────────────────────── */

describe("registration progress", () => {
  /**
   * The tuple that used to drive the strip stopped at `verifiedSuccessfully`,
   * so fourteen steps rendered no strip at all.
   */
  it("covers every step in the flow order", () => {
    const skipped = new Set(["intro", "loading", "done"]);
    for (const step of USER_FLOW_ORDER) {
      if (skipped.has(step)) {
        expect(hasProgress(step)).toBe(false);
      } else {
        expect(hasProgress(step)).toBe(true);
      }
    }
    expect(PROGRESS_TOTAL).toBe(USER_FLOW_ORDER.length - skipped.size);
  });

  it("moves forward across the flow", () => {
    expect(progressFor("interests").percent).toBeGreaterThan(
      progressFor("userRole").percent,
    );
    expect(progressFor("userRole").percent).toBeGreaterThan(
      progressFor("privacy").percent,
    );
  });

  /**
   * Stands in for "monotonically non-decreasing `aria-valuenow` on every step"
   * for both walks: the component renders `percent` verbatim, so a monotone
   * sequence here is a monotone sequence in the DOM.
   */
  it("never goes backwards on either role's walk", () => {
    const patient = [
      "privacy", "profile", "credentials", "emailOtp", "phone",
      "verifiedSuccessfully", "userRole", "diagnosis", "medicalCenter",
      "address", "createProfile", "profilePic", "about", "interests",
      "languages", "photos", "allSet",
    ] as const;
    const caregiver = [
      "privacy", "profile", "guardian", "guardianOtp", "credentials",
      "emailOtp", "phone", "verifiedSuccessfully", "userRole",
      "cgRelationship", "cgPatientAge", "diagnosis", "medicalCenter",
      "address", "createProfile", "profilePic", "about", "interests",
      "languages", "photos", "allSet",
    ] as const;

    for (const walk of [patient, caregiver]) {
      const values = walk.map((s) => progressFor(s).percent);
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
      }
      expect(values.at(-1)).toBeGreaterThan(values[0]!);
    }
  });

  it("renders the strip on every step it covers", () => {
    const shell = sourceOf("app/register/_components/RegisterShell.tsx");
    expect(shell).toContain('data-testid="register-progress"');
    expect(shell).toContain("aria-valuenow={percent}");
    expect(shell).toContain("hasProgress(step)");
    /* The six-step tuple must be gone from the shell entirely. */
    expect(shell).not.toContain("USER_REGISTER_STEPS");
  });

  /** Display order has to be walk order, or the bar could move backwards. */
  it("lists the steps in the flow's own order, once each", () => {
    expect(PROGRESS_STEPS).toEqual(
      USER_FLOW_ORDER.filter(
        (s) => s !== "intro" && s !== "loading" && s !== "done",
      ),
    );
    expect(new Set(PROGRESS_STEPS).size).toBe(PROGRESS_TOTAL);
  });
});

/* ── register-caregiver-medical-steps ───────────────────────────────────── */

describe("caregivers walk the medical branch", () => {
  /**
   * Mobile's path is linear: the caregiver pair sits immediately before the
   * medical pair, and only the role step branches — to *skip* the caregiver
   * screens, never the medical ones (`EnrollmentProvider.utils.tsx:25-32`,
   * `conditions.ts:23-29`).
   */
  it("routes patient age → diagnosis → medical centre → address", () => {
    const page = sourceOf("app/register/page.tsx");
    expect(page).toMatch(
      /handleCGPatientAgeContinue = useCallback\(\(\) => \{\s*goToStep\("diagnosis"\)/,
    );
    expect(page).toMatch(
      /handleDiagnosisContinue[\s\S]{0,160}goToStep\("medicalCenter"\)/,
    );
    expect(page).toMatch(
      /handleMedicalCenterContinue = useCallback\(\(\) => \{\s*goToStep\("address"\)/,
    );
    /* The skip is gone. */
    expect(page).not.toMatch(
      /handleCGPatientAgeContinue = useCallback\(\(\) => \{\s*goToStep\("address"\)/,
    );
  });

  /** `BackDiagnosisCondition`: caregiver back 1, everyone else back 3. */
  it("backs out of diagnosis by the route it came in on", () => {
    const page = sourceOf("app/register/page.tsx");
    expect(page).toMatch(
      /step === "diagnosis"[\s\S]{0,200}role === "CAREGIVER" \? "cgPatientAge" : "userRole"/,
    );
    expect(USER_REGISTER_BACK_FALLBACK.address).toBe("medicalCenter");
    expect(USER_REGISTER_BACK_FALLBACK.medicalCenter).toBe("diagnosis");
    /* Role-dependent, so it must not also sit in the flat map. */
    expect(USER_REGISTER_BACK_FALLBACK.diagnosis).toBeUndefined();
  });

  /**
   * The coercion at the call site is what erased the role. Passing the value
   * through a narrowing helper keeps `CAREGIVER` intact.
   */
  it("stops coercing the caregiver to a patient", () => {
    const page = sourceOf("app/register/page.tsx");
    expect(page).toContain("diagnosisRole(methods.getValues(\"userType\"))");
    expect(page).not.toMatch(/=== "SURVIVOR" \? "SURVIVOR" : "PATIENT"/);

    const step = sourceOf("app/register/_components/StepDiagnosis.tsx");
    expect(step).toContain("userType: DiagnosisRole");
    /* CAREGIVER follows PATIENT everywhere, as mobile gates on !== SURVIVOR. */
    expect(step).not.toMatch(/userType === "PATIENT"/);
  });

  it("keeps the caregiver's answers on the finalize payload", () => {
    const finalize = sourceOf("lib/user-signup/userEnrollmentFinalize.ts");
    /* The relation writes are role-agnostic — assert they stayed that way. */
    for (const marker of ["CREATE_DIAGNOSIS_USER", "CREATE_HOSPITAL_USER"]) {
      const at = finalize.indexOf(marker);
      expect(at).toBeGreaterThan(-1);
      expect(finalize.slice(at - 400, at)).not.toContain("CAREGIVER");
    }
  });
});

/* ── deeplink-buddyid-landing ───────────────────────────────────────────── */

describe("the Buddy-ID landing route", () => {
  const viewer = { id: "me", birth: "1990-01-01" };
  const adult = { id: "them", name: "Grace Hopper", birth: "1988-05-04" };

  it("answers with the reason mobile acts on", () => {
    expect(buddyIdGuard(null, viewer)).toBe("notFound");
    expect(buddyIdGuard({ ...adult, id: "me" }, viewer)).toBe("self");
    expect(buddyIdGuard({ ...adult, isSnooze: true }, viewer)).toBe("snoozed");
    /* A child in the 7–12 bracket is not connectable from an adult account. */
    expect(buddyIdGuard({ id: "them", birth: "2016-01-01" }, viewer)).toBe(
      "ageRule",
    );
    expect(buddyIdGuard(adult, viewer)).toBe("ok");
  });

  it("carries the reason on the outcome, alongside the message", () => {
    const out = evaluateBuddyIdMatch({ ...adult, isSnooze: true }, viewer);
    expect(out.kind).toBe("error");
    if (out.kind === "error") {
      expect(out.reason).toBe("snoozed");
      expect(out.message.length).toBeGreaterThan(0);
    }
  });

  /** The URL mobile writes into its QR code, so the route has to exist. */
  it("exists at the path the shared link uses", () => {
    expect(existsSync("app/(app)/buddyId/[buddyId]/page.tsx")).toBe(true);
    expect(sourceOf("components/profile/BuddyIdScreen.tsx")).toContain(
      "/buddyId/${buddyId}",
    );
  });

  /**
   * Stands in for the three Playwright walks: your own id goes to your own
   * profile (mobile navigates Home → Profile), a refusal renders here rather
   * than as a 404, and everything else hands off to `buddyProfileHref`.
   */
  it("acts on each reason the way mobile does", () => {
    const screen = sourceOf("components/buddies/BuddyIdLandingScreen.tsx");
    expect(screen).toMatch(
      /reason === "self"[\s\S]{0,80}router\.replace\("\/profile"\)/,
    );
    expect(screen).toContain("router.replace(buddyProfileHref(outcome))");
    expect(screen).toContain("setRefusal(outcome.message)");
    expect(screen).not.toContain("notFound()");
  });
});

/* ── auth-password-reset-flow ───────────────────────────────────────────── */

describe("the reset schema", () => {
  const ok = {
    code: "123456",
    password: "Abcdefg1!",
    confirmPassword: "Abcdefg1!",
  };

  it("accepts a compliant password", () => {
    expect(resetPasswordSchema.safeParse(ok).success).toBe(true);
  });

  it("reports exactly one error per rule violated", () => {
    const cases: Array<[string, string]> = [
      ["Abc1!", "too short"],
      ["abcdefg1!", "no uppercase"],
      ["ABCDEFG1!", "no lowercase"],
      ["Abcdefgh!", "no digit"],
      ["Abcdefg12", "no special"],
    ];

    for (const [password, label] of cases) {
      const result = resetPasswordSchema.safeParse({
        ...ok,
        password,
        confirmPassword: password,
      });
      expect(result.success, label).toBe(false);
      if (!result.success) {
        expect(result.error.issues, label).toHaveLength(1);
      }
    }
  });

  it("reports the mismatch on its own", () => {
    const result = resetPasswordSchema.safeParse({
      ...ok,
      confirmPassword: "Abcdefg2!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]!.path).toEqual(["confirmPassword"]);
    }
  });

  it("requires the whole code", () => {
    expect(
      resetPasswordSchema.safeParse({ ...ok, code: "12345" }).success,
    ).toBe(false);
  });

  /**
   * The reset form and the signup form must agree, or a password accepted at
   * signup is refused at reset (and vice versa).
   */
  it("enforces the same password rules as signup", () => {
    const samples = [
      "Abcdefg1!",
      "abcdefg1!",
      "ABCDEFG1!",
      "Abcdefgh!",
      "Abcdefg12",
      "Ab1!",
      "",
    ];
    for (const password of samples) {
      const signup = credentialsSchema.safeParse({
        email: "a@b.co",
        password,
        confirmPassword: password,
      }).success;
      const reset = resetPasswordSchema.safeParse({
        code: "123456",
        password,
        confirmPassword: password,
      }).success;
      expect(reset, password).toBe(signup);
    }
  });

  it("validates the email on the first step", () => {
    expect(resetEmailSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(resetEmailSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("the reset service", () => {
  beforeEach(() => {
    vi.mocked(Auth.forgotPassword).mockReset();
    vi.mocked(Auth.forgotPasswordSubmit).mockReset();
  });

  it("asks Cognito with the plain lowercased email", async () => {
    vi.mocked(Auth.forgotPassword).mockResolvedValue({} as never);
    await expect(sendResetCode("  Person@Example.COM ")).resolves.toEqual({
      status: "SENT",
    });
    expect(Auth.forgotPassword).toHaveBeenCalledWith("person@example.com");
  });

  it("classifies the refusals it is expected to explain", async () => {
    const cases: Array<[string, string]> = [
      ["UserNotFoundException", "UNKNOWN_EMAIL"],
      ["LimitExceededException", "RATE_LIMITED"],
      ["InvalidParameterException", "UNCONFIRMED"],
    ];
    for (const [code, status] of cases) {
      vi.mocked(Auth.forgotPassword).mockRejectedValueOnce({ code });
      await expect(sendResetCode("a@b.co")).resolves.toEqual({ status });
    }
  });

  it("submits the code and the new password", async () => {
    vi.mocked(Auth.forgotPasswordSubmit).mockResolvedValue("SUCCESS" as never);
    await expect(
      submitNewPassword({
        email: "A@b.co",
        code: " 123456 ",
        password: "Abcdefg1!",
      }),
    ).resolves.toEqual({ status: "OK" });
    expect(Auth.forgotPasswordSubmit).toHaveBeenCalledWith(
      "a@b.co",
      "123456",
      "Abcdefg1!",
    );
  });

  it("names a wrong or stale code", async () => {
    vi.mocked(Auth.forgotPasswordSubmit).mockRejectedValueOnce({
      code: "CodeMismatchException",
    });
    await expect(
      submitNewPassword({ email: "a@b.co", code: "000000", password: "Abcdefg1!" }),
    ).resolves.toEqual({ status: "CODE_MISMATCH" });

    vi.mocked(Auth.forgotPasswordSubmit).mockRejectedValueOnce({
      code: "ExpiredCodeException",
    });
    await expect(
      submitNewPassword({ email: "a@b.co", code: "000000", password: "Abcdefg1!" }),
    ).resolves.toEqual({ status: "CODE_EXPIRED" });
  });

  /** An unrecognised failure is a bug, not a message to paste at the member. */
  it("rethrows anything it cannot explain", async () => {
    vi.mocked(Auth.forgotPassword).mockRejectedValueOnce(new Error("network"));
    await expect(sendResetCode("a@b.co")).rejects.toThrow("network");
  });
});

describe("the reset route", () => {
  it("exists where the login screen has always linked", () => {
    expect(existsSync("app/(auth)/forgot-password/page.tsx")).toBe(true);
    expect(sourceOf("app/(auth)/login/page.tsx")).toContain(
      'href="/forgot-password"',
    );
  });

  /** Mobile signs the member in on success (`RecoveryPassword.tsx:67`). */
  it("signs in on success and routes by onboarding state", () => {
    const page = sourceOf("app/(auth)/forgot-password/page.tsx");
    expect(page).toContain("defaultLoginService.login");
    expect(page).toContain('router.push("/groups")');
    expect(page).toContain("RESUME_PHONE");
    expect(page).toContain("RESUME_USER_ROLE");
  });

  /**
   * An unknown address must reach the same screen as a known one, or the form
   * becomes a way to enumerate who has an account here.
   */
  it("does not reveal whether an email has an account", () => {
    const page = sourceOf("app/(auth)/forgot-password/page.tsx");
    expect(page).not.toContain("UNKNOWN_EMAIL");
  });

  it("drops the session stubs the flow used to be blocked on", () => {
    expect(existsSync("lib/auth.ts")).toBe(false);
    expect(existsSync("app/actions/auth.ts")).toBe(false);
    expect(sourceOf("lib/validations.ts")).not.toContain("forgotPasswordSchema");
  });
});

/* ── register-verified-phone-echo ───────────────────────────────────────── */

describe("the verified-phone echo", () => {
  /** Mobile's whole screen is the number (`AccountSetupVerifiedSuccessfully`). */
  it("shows the number that was verified, in the verified form", () => {
    const step = sourceOf(
      "app/register/_components/StepVerifiedSuccessfully.tsx",
    );
    expect(step).toContain("buildE164(");
    expect(step).toContain('getValues("phoneCountryIso2")');
    expect(step).toContain('getValues("phoneNational")');
    expect(step).toContain('data-testid="verified-phone"');
  });
});
