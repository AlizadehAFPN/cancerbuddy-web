import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/raiseUserLambda", () => ({ raiseUserLambda: vi.fn() }));
vi.mock("@/lib/aws/appsyncGraphql", () => ({ executeAppSyncGraphql: vi.fn() }));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { resourceLinksFor } from "@/lib/navigation/appNav";
import { formatBuildIdentification } from "./buildInfo";
import {
  buildChangeStatusPayload,
  canContinueFromDiagnosis,
  changeStatusOptionsFor,
  progressDenominator,
  remissionStampFor,
  routeFor,
} from "./changeStatus";
import { applyStatusPathA, applyStatusPathB } from "./changeStatusWrite";
import {
  DELETION_REASONS,
  deleteAccount,
  deleteSubmitDisabled,
  deletionReasonValue,
} from "./deleteAccount";
import {
  otherMemberId,
  shouldUnfreeze,
  snoozeOrUnsnooze,
  updateFrozenChannels,
} from "./snooze";
import { isGatedRoute } from "@/components/account/SnoozeGate";

const invoke = vi.mocked(raiseUserLambda);
const exec = vi.mocked(executeAppSyncGraphql);

function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

function birthFor(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0, 1);
  return `${d.getFullYear()}-01-01`;
}

/* ── snooze-toggle-and-backend ──────────────────────────────────────────── */

describe("snooze", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";
    invoke.mockReset();
    invoke.mockResolvedValue("{}");
  });

  it("sends the two verbs mobile sends", async () => {
    await snoozeOrUnsnooze("u1", true);
    expect(invoke.mock.calls[0]![0]).toBe("snooze");
    expect(invoke.mock.calls[0]![2]).toEqual({ userId: "u1" });

    await snoozeOrUnsnooze("u1", false);
    // Mobile's constant is UNSNOOZE; its *value* is `noSnooze`.
    expect(invoke.mock.calls[1]![0]).toBe("noSnooze");
  });

  it("freezes every channel when snoozing", async () => {
    const updates: unknown[][] = [];
    const channel = (id: string) => ({
      id,
      state: { members: { a: { user: { id: "u1" } } } },
      update: async (...args: unknown[]) => {
        updates.push([id, ...args]);
      },
    });

    await updateFrozenChannels({
      client: { queryChannels: async () => [channel("c1"), channel("c2")] },
      userId: "u1",
      snooze: true,
    });

    expect(updates).toHaveLength(2);
    expect(updates[0]![1]).toEqual({ frozen: true });
    expect(updates[0]![2]).toEqual({ text: "Currently taking a break" });
  });

  /** The rule that is easy to get wrong, and reaches another member. */
  it("leaves a channel frozen when the other member is also snoozed", async () => {
    const updates: unknown[][] = [];
    const channel = (id: string, otherId: string) => ({
      id,
      state: { members: { me: { user: { id: "u1" } }, them: { user: { id: otherId } } } },
      update: async (...args: unknown[]) => {
        updates.push([id, ...args]);
      },
    });

    await updateFrozenChannels({
      client: {
        queryChannels: async () => [channel("awake", "u2"), channel("asleep", "u3")],
      },
      userId: "u1",
      snooze: false,
      readIsSnoozed: async (id) => id === "u3",
    });

    expect(updates.map((u) => u[0])).toEqual(["awake"]);
    expect(updates[0]![1]).toEqual({ frozen: false });
  });

  it("states the unfreeze rule positively", () => {
    expect(shouldUnfreeze({ otherMemberIsSnoozed: false })).toBe(true);
    expect(shouldUnfreeze({ otherMemberIsSnoozed: true })).toBe(false);
  });

  it("finds the other member of a pair", () => {
    expect(
      otherMemberId({ a: { user: { id: "me" } }, b: { user: { id: "them" } } }, "me"),
    ).toBe("them");
    expect(otherMemberId({ a: { user: { id: "me" } } }, "me")).toBeNull();
    expect(otherMemberId(undefined, "me")).toBeNull();
  });
});

/* ── snooze-app-wide-gate ───────────────────────────────────────────────── */

describe("the snooze gate", () => {
  it("replaces the member-facing surfaces", () => {
    for (const path of ["/buddies", "/groups", "/groups/g1", "/notifications", "/profile", "/live/e1"]) {
      expect(isGatedRoute(path), path).toBe(true);
    }
  });

  /** Chat is not one of mobile's seven gated navigators — the conversations are
      frozen, not hidden. Settings is where the way out lives. */
  it("leaves chat, settings and the legal pages alone", () => {
    for (const path of ["/chat", "/chat/c1", "/settings", "/settings/delete-account", "/privacy", "/support"]) {
      expect(isGatedRoute(path), path).toBe(false);
    }
  });

  it("is mounted above every authenticated route, not per-screen", () => {
    const layout = sourceOf("app/(app)/layout.tsx");
    expect(layout).toMatch(/<SnoozeGate>\{children\}<\/SnoozeGate>/);
  });
});

/* ── hide-settings-from-hosts ───────────────────────────────────────────── */

describe("the account menu", () => {
  const hrefs = (userType: string | null) =>
    resourceLinksFor(userType).map((item) => item.href);

  it("offers Settings to members", () => {
    for (const type of ["PATIENT", "SURVIVOR", "CAREGIVER"]) {
      expect(hrefs(type)).toContain("/settings");
    }
  });

  it("withholds it from a host, a support account and an unknown type", () => {
    for (const type of ["HOST", "SUPPORT", null]) {
      expect(hrefs(type)).not.toContain("/settings");
    }
  });

  it("keeps every other row for everyone", () => {
    expect(hrefs("HOST")).toContain("/partners");
    expect(hrefs("HOST")).toContain("/funders");
  });

  /** Hiding the row is not a guard — a typed URL must be turned away too. */
  it("guards the screen itself", () => {
    const screen = sourceOf("components/account/SettingsScreen.tsx");
    expect(screen).toMatch(/MEMBER_TYPES/);
    expect(screen).toMatch(/loaded && isMember/);
  });
});

/* ── settings-build-identification ──────────────────────────────────────── */

describe("build identification", () => {
  it("formats version and short SHA", () => {
    expect(formatBuildIdentification("1.4.0", "a1b2c3d4e5")).toBe("1.4.0 (a1b2c3d)");
  });

  it("says so plainly when either half is missing", () => {
    expect(formatBuildIdentification(undefined, "a1b2c3d")).toBe("Development build");
    expect(formatBuildIdentification("1.4.0", "")).toBe("Development build");
  });

  it("is injected at build time", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toMatch(/NEXT_PUBLIC_APP_VERSION/);
    expect(config).toMatch(/NEXT_PUBLIC_BUILD_SHA/);
  });
});

/* ── delete-account ─────────────────────────────────────────────────────── */

describe("account deletion", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";
    process.env.NEXT_PUBLIC_GETSTREAM_LAMBDA = "getstream-demo";
    invoke.mockReset();
    exec.mockReset();
    invoke.mockResolvedValue("{}");
    exec.mockResolvedValue({ data: {} } as never);
  });

  it("keeps submit disabled until there is something to record", () => {
    expect(deleteSubmitDisabled({ reason: "" })).toBe(true);
    expect(deleteSubmitDisabled({ reason: "I found support elsewhere" })).toBe(false);
    expect(deleteSubmitDisabled({ reason: "Other", detail: "  " })).toBe(true);
    expect(deleteSubmitDisabled({ reason: "Other", detail: "moving on" })).toBe(false);
  });

  it("records the free text for Other", () => {
    expect(deletionReasonValue({ reason: "Other", detail: " moving on " })).toBe("moving on");
    expect(deletionReasonValue({ reason: "Spam-free reason" })).toBe("Spam-free reason");
  });

  it("offers mobile's five reasons", () => {
    expect([...DELETION_REASONS]).toEqual([
      "I am (or my patient is) in remission",
      "I found support elsewhere",
      "This app isn't what I expected",
      "I didn't find the support I need here",
      "Other",
    ]);
  });

  /**
   * The order is the contract. The reason goes first — mobile records it after
   * clearing the session, by which point the call is unauthenticated.
   */
  it("records the reason, then deletes Stream, then both lambdas in order", async () => {
    const order: string[] = [];
    exec.mockImplementation(async () => {
      order.push("createDeleteReason");
      return { data: {} } as never;
    });
    invoke.mockImplementation(async (type: string) => {
      order.push(`lambda:${type}`);
      return "{}";
    });

    const deleted: string[] = [];
    await deleteAccount({
      userId: "u1",
      name: "Ada",
      reason: "I found support elsewhere",
      client: {
        queryChannels: async () => {
          order.push("queryChannels");
          return [
            {
              id: "c1",
              delete: async () => {
                deleted.push("c1");
              },
            },
          ];
        },
      },
    });

    expect(order).toEqual([
      "createDeleteReason",
      "queryChannels",
      "lambda:delete",
      "lambda:deleteAccount",
    ]);
    expect(deleted).toEqual(["c1"]);

    // Each verb addresses its own Lambda — they are different functions.
    expect(invoke.mock.calls[0]![1]).toBe("getstream-demo");
    expect(invoke.mock.calls[0]![2]).toEqual({ cognitoId: "u1", name: "Ada" });
    expect(invoke.mock.calls[1]![1]).toBe("users-demo");
    expect(invoke.mock.calls[1]![2]).toEqual({ userId: "u1" });
  });

  /** A member with an unreachable Stream client still gets deleted. */
  it("deletes the account even when Stream cleanup fails", async () => {
    await deleteAccount({
      userId: "u1",
      name: "Ada",
      reason: "Other reason",
      client: {
        queryChannels: async () => {
          throw new Error("stream down");
        },
      },
    });
    expect(invoke.mock.calls.map((c) => c[0])).toEqual(["delete", "deleteAccount"]);
  });

  /** A failed delete must not tell the member their account is gone. */
  it("throws when a lambda fails, so the caller keeps them signed in", async () => {
    invoke.mockRejectedValueOnce(new Error("500"));
    await expect(
      deleteAccount({ userId: "u1", name: "Ada", reason: "x", client: null }),
    ).rejects.toThrow();
  });

  it("only shows the success screen after a successful delete", () => {
    const screen = sourceOf("components/account/DeleteAccountScreen.tsx");
    expect(screen).toMatch(/await deleteAccount\(\{[\s\S]*?\}\);\s*setConfirming\(false\);\s*setDeleted\(true\);/);
    expect(screen).toMatch(/catch[\s\S]*?setConfirming\(false\);/);
  });
});

/* ── forced-signout-return ──────────────────────────────────────────────── */

describe("finishing a signed-out flow", () => {
  it("drops the session and hard-navigates home", () => {
    const flow = sourceOf("lib/account/finishSignedOutFlow.ts");
    expect(flow).toMatch(/unregisterPushDevice\(\)/);
    expect(flow).toMatch(/disconnectStream\(\)/);
    expect(flow).toMatch(/await signOut\(\)/);
    expect(flow).toMatch(/window\.location\.replace\("\/"\)/);
  });

  it("is what all three account-altering flows call", () => {
    for (const path of [
      "components/account/DeleteAccountScreen.tsx",
      "components/account/ChangeStatusScreen.tsx",
    ]) {
      expect(sourceOf(path)).toMatch(/finishSignedOutFlow\(\)/);
    }
  });
});

/* ── change-status-select-and-path-a ────────────────────────────────────── */

describe("change status — the options", () => {
  const adult = birthFor(30);
  const minor = birthFor(15);

  it("offers mobile's by-role sets to an adult", () => {
    expect(changeStatusOptionsFor({ currentUserType: "PATIENT", birth: adult })).toEqual([
      "SURVIVOR",
      "CAREGIVER",
    ]);
    expect(changeStatusOptionsFor({ currentUserType: "CAREGIVER", birth: adult })).toEqual(["PATIENT"]);
    expect(changeStatusOptionsFor({ currentUserType: "SURVIVOR", birth: adult })).toEqual(["PATIENT"]);
  });

  /**
   * Under 18, CAREGIVER is withheld. Mobile's two filters contradict each other
   * for an under-18 caregiver; the by-role rule is the intended one, so that
   * account is offered PATIENT only.
   */
  it("withholds caregiver from a minor, and resolves mobile's contradiction", () => {
    expect(changeStatusOptionsFor({ currentUserType: "PATIENT", birth: minor })).toEqual(["SURVIVOR"]);
    expect(changeStatusOptionsFor({ currentUserType: "SURVIVOR", birth: minor })).toEqual(["PATIENT"]);
    expect(changeStatusOptionsFor({ currentUserType: "CAREGIVER", birth: minor })).toEqual(["PATIENT"]);
  });

  it("offers nothing to an account type that cannot switch", () => {
    expect(changeStatusOptionsFor({ currentUserType: "HOST", birth: adult })).toEqual([]);
  });

  it("routes SURVIVOR and SURVIVOR→PATIENT down Path A, everything else down B", () => {
    expect(routeFor("SURVIVOR", "PATIENT")).toBe("A");
    expect(routeFor("SURVIVOR", "CAREGIVER")).toBe("A");
    expect(routeFor("PATIENT", "SURVIVOR")).toBe("A");
    expect(routeFor("PATIENT", "CAREGIVER")).toBe("B");
    expect(routeFor("CAREGIVER", "PATIENT")).toBe("B");
    expect(routeFor("CAREGIVER", "SURVIVOR")).toBe("B");
  });
});

describe("change status — Path A", () => {
  beforeEach(() => {
    exec.mockReset();
    exec.mockResolvedValue({ data: {} } as never);
  });

  /** Mobile stamps *today*, not the end of the month. */
  it("stamps today's date when entering remission, and clears it when leaving", () => {
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(remissionStampFor("SURVIVOR")).toBe(expected);
    expect(remissionStampFor("PATIENT")).toBeNull();
  });

  it("writes the chosen type in one mutation", async () => {
    await applyStatusPathA({ userId: "u1", next: "SURVIVOR" });
    expect(exec).toHaveBeenCalledTimes(1);
    const input = exec.mock.calls[0]![0].variables?.input as Record<string, unknown>;
    expect(input.id).toBe("u1");
    expect(input.userType).toBe("SURVIVOR");
    expect(input.inRemissionSince).toBeTruthy();
  });

  /** Mobile derives the target from the *current* type; web uses the choice. */
  it("takes the target from the selection", async () => {
    await applyStatusPathA({ userId: "u1", next: "PATIENT" });
    const input = exec.mock.calls[0]![0].variables?.input as Record<string, unknown>;
    expect(input.userType).toBe("PATIENT");
    expect(input.inRemissionSince).toBeNull();
  });
});

/* ── change-status-path-b ───────────────────────────────────────────────── */

describe("change status — Path B", () => {
  const values = {
    userId: "u1",
    diagnosisIds: ["d1", "d2"],
    treatmentStatusId: "ts1",
    treatmentIds: ["t1"],
    hospitalIds: ["h1"],
    relationshipId: "r1",
    patientBirth: "03/2010",
  };

  it("builds the caregiver payload with its wrapper key", () => {
    expect(buildChangeStatusPayload(values, "CAREGIVER")).toEqual({
      patientTocaregivers: {
        userId: "u1",
        DiagnosisID: ["d1", "d2"],
        userTreatmentStatusId: "ts1",
        TreatmentsID: ["t1"],
        HospitalsID: ["h1"],
        userRelationshipId: "r1",
        patientBirth: "03/2010",
      },
    });
  });

  it("drops the caregiver-only keys in the other direction", () => {
    expect(buildChangeStatusPayload(values, "PATIENT")).toEqual({
      caregiverTopatients: {
        userId: "u1",
        DiagnosisID: ["d1", "d2"],
        userTreatmentStatusId: "ts1",
        TreatmentsID: ["t1"],
        HospitalsID: ["h1"],
      },
    });
  });

  it("counts four screens to caregiver and two the other way", () => {
    expect(progressDenominator("CAREGIVER")).toBe(4);
    expect(progressDenominator("PATIENT")).toBe(2);
    expect(progressDenominator("SURVIVOR")).toBe(2);
  });

  it("lets Pre-treatment continue with no treatments, and nothing else", () => {
    expect(canContinueFromDiagnosis({ treatmentStatusLabel: "Pre-treatment", treatmentIds: [] })).toBe(true);
    expect(canContinueFromDiagnosis({ treatmentStatusLabel: "In treatment", treatmentIds: [] })).toBe(false);
    expect(canContinueFromDiagnosis({ treatmentStatusLabel: "In treatment", treatmentIds: ["t1"] })).toBe(true);
  });

  it("posts the payload under one changeStatus invoke", async () => {
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";
    invoke.mockReset();
    invoke.mockResolvedValue("{}");

    await applyStatusPathB(values, "CAREGIVER");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]![0]).toBe("changeStatus");
    expect(invoke.mock.calls[0]![2]).toHaveProperty("patientTocaregivers");
  });
});
