import { describe, expect, it } from "vitest";

import { LambdaPayloadType } from "./lambdaPayload";

/**
 * Acceptance check for `lambda-verb-registry` in `docs/parity/WORKLIST.md` Phase 0.
 *
 * Ten later work items import these constants, so the registry is the first thing
 * built and the first thing asserted.
 */
describe("lambda-verb-registry", () => {
  /**
   * The nine live verbs the worklist requires. Note `delete` is a
   * `GETSTREAM_LAMBDA` verb, not a `USERS_LAMBDA` one — the worklist's wording
   * said otherwise; `cancerbuddyapp/src/utils/lambda.ts:115-122` is the proof.
   */
  it("declares every live verb the later work items need", () => {
    const wireStrings = Object.values(LambdaPayloadType);
    const required = {
      delete: true,
      deleteAccount: true,
      snooze: true,
      noSnooze: true,
      changeStatus: true,
      supportemail: true,
      deleteMessage: true,
      replyMessage: true,
      ambassadorMessage: true,
    } satisfies Record<string, true>;

    for (const verb of Object.keys(required)) {
      expect(wireStrings, `missing wire string "${verb}"`).toContain(verb);
    }
  });

  /**
   * Load-bearing, and wrong until the demotion-verification pass caught it: the
   * mobile constant is named `CREATE_AMBASSADOR_MESSAGE` but its value is
   * `ambassadorMessage`. `cancerbuddyapp/src/types/utils/lambda.ts:23`. The Lambda
   * rejects `createAmbassadorMessage`, so this asserts the value, not the name.
   */
  it("sends ambassadorMessage, not createAmbassadorMessage", () => {
    expect(LambdaPayloadType.CREATE_AMBASSADOR_MESSAGE).toBe("ambassadorMessage");
    expect(Object.values(LambdaPayloadType)).not.toContain("createAmbassadorMessage");
  });

  /** Two verbs whose mobile constant name differs from the web one; assert the wire value. */
  it("keeps the wire strings mobile uses where the constant names diverge", () => {
    expect(LambdaPayloadType.UNSNOOZE).toBe("noSnooze");
    expect(LambdaPayloadType.COMMENTS).toBe("supportemail");
  });

  it("has no duplicate wire strings", () => {
    const values = Object.values(LambdaPayloadType);
    expect(new Set(values).size).toBe(values.length);
  });
});
