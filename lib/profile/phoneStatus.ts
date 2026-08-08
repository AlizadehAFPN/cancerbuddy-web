import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

/**
 * Whether the signed-in account has a phone number.
 *
 * Accounts created before the number became part of signup have none, and web
 * offers no phone-capture surface outside the registration wizard — so such an
 * account could never gain one in a browser. Mobile prompts for it.
 */

const GET_PHONE = /* GraphQL */ `
  query getUserPhone($id: ID!) {
    getUser(id: $id) {
      id
      phone
    }
  }
`;

/** Session-scoped, so declining does not re-prompt on every navigation. */
export const PHONE_PROMPT_DISMISSED_KEY = "phonePromptDismissed";

export async function fetchPhone(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await executeAppSyncGraphql<{
      getUser: { phone?: string | null } | null;
    }>({ query: GET_PHONE, variables: { id: userId }, authWithUserPool: true });
    return data?.getUser?.phone?.trim() || null;
  } catch {
    // Fail closed: an unreadable answer must not produce a prompt for someone
    // who already has a number.
    return "unknown";
  }
}

/**
 * Whether to ask.
 *
 * `"unknown"` is the read-failed sentinel and deliberately counts as "has one" —
 * a network blip should never interrupt someone with a modal they cannot
 * dismiss meaningfully.
 */
export function shouldPromptForPhone(
  phone: string | null,
  dismissed: boolean,
): boolean {
  if (dismissed) return false;
  return phone === null;
}
