/**
 * Final host enrollment after phone verification — mirrors mobile
 * `LoadingPersonalInformation` → `UpdateRegisterUserUtil` + photo pipeline +
 * `LoginInLambdaUtil` (`cancerbuddyapp/src/screens/.../LoadingPersonalInformation.tsx`,
 * `register.ts`, `signup.ts`, `useS3Upload.ts`).
 *
 * Web scope: S3 upload + `createPicture` + `updateUser` (HOST, bio, profile pic)
 * + GetStream LOGIN lambda + Users LOGIN lambda (FCM token omitted on web) +
 * support channel bootstrap (same sequence as mobile `HomeBuddies` when
 * `pendingSupportChannel` is set: `createSupportConnection` → AppSync
 * connection → `supportMessage` Lambda). Failures in the support bootstrap
 * are non-blocking (matches mobile `createSupportChannel` catch): enrollment
 * still completes and `pendingSupportChannel` stays set for a later mobile
 * open.
 */

import { Auth, Storage } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { fetchUserBuddyId } from "@/lib/aws/appsyncUserQueries";
import { bootstrapSupportChannelAfterEnrollment } from "@/lib/host-signup/bootstrapSupportChannel";
import { PHOTO_MAX_BYTES } from "@/lib/host-signup/constants";

/** Same operation names / shapes as `cancerbuddyapp/src/graphql/mutations/user.ts`. */
const CREATE_PICTURE = /* GraphQL */ `
  mutation addPicture($input: CreatePictureInput!) {
    createPicture(input: $input) {
      id
      name
      file {
        bucket
        region
        key
      }
    }
  }
`;

const UPDATE_USER_HOST_PROFILE = /* GraphQL */ `
  mutation updateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

/** AsyncStorage key on RN; used after enrollment before Stream connects. */
const PENDING_SUPPORT_CHANNEL_KEY = "pendingSupportChannel";

/**
 * Same keys as mobile `LoadingPersonalInformation` `setAnalyticsFlags`
 * (`localStorageAnalytics` in `cancerbuddyapp`).
 */
const ENROLLMENT_ANALYTICS_SEED_KEYS = [
  "chatWithFirstBuddy",
  "connectWithFirstBuddy",
  "joinFirstGroup",
  "comment",
  "post",
] as const;

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) {
    throw new Error(
      "NEXT_PUBLIC_USERS_LAMBDA is not set. Add it to .env.local (e.g. NEXT_PUBLIC_USERS_LAMBDA=users-demo), save, then stop and run `yarn dev` again.",
    );
  }
  return v;
}

function getStreamLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_GETSTREAM_LAMBDA?.trim();
  if (!v) {
    throw new Error(
      "NEXT_PUBLIC_GETSTREAM_LAMBDA is not set. Add it to .env.local (e.g. NEXT_PUBLIC_GETSTREAM_LAMBDA=your-getstream-login-function-name), save, then stop and run `yarn dev` again so Next.js picks it up.",
    );
  }
  return v;
}

function s3BucketConfig(): { bucket: string; region: string } {
  const bucket = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET?.trim();
  const region = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION?.trim();
  if (!bucket || !region) {
    throw new Error(
      "NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET and NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION must be set for photo upload.",
    );
  }
  return { bucket, region };
}

function newPictureObjectKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${c.randomUUID()}.jpg`;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
}

/**
 * @param lambdaDisplayName — mobile passes first token of legal name to GetStream (`signup.ts` / `register.ts`).
 */
export async function finalizeHostEnrollmentAfterBio(input: {
  photo: File;
  bio: string;
  lambdaDisplayName: string;
}): Promise<{
  cognitoUserId: string;
  buddyId: string | null;
  supportChannelReady: boolean;
  supportChannelDeferredToApp: boolean;
}> {
  ensureAmplifyConfigured();

  const user = await Auth.currentAuthenticatedUser({ bypassCache: true });
  const cognitoUserId = user.getUsername()?.trim();
  if (!cognitoUserId) {
    throw new Error("Could not read your account id. Please sign in again.");
  }

  const { bucket, region } = s3BucketConfig();
  const objectKey = newPictureObjectKey();

  /* Defence in depth: the PhotoPicker validates the *pre-crop* file, and
     the cropper writes a 512×512 JPEG at 0.92 quality (usually well below
     a megabyte). Re-check the cropped file here so a caller that hands us
     a manually-constructed `File` cannot bypass the limit, and so an
     unreasonably large blob never reaches S3. */
  if (!input.photo) {
    throw new Error("No photo was provided. Please choose a photo and try again.");
  }
  if (input.photo.size === 0) {
    throw new Error("Your photo file appears to be empty. Please pick another image.");
  }
  if (input.photo.size > PHOTO_MAX_BYTES) {
    throw new Error(
      "Your photo is too large. Please choose a smaller image and try again.",
    );
  }

  const putResult = await Storage.put(objectKey, input.photo, {
    contentType: "image/jpeg",
  });

  const key =
    putResult &&
    typeof putResult === "object" &&
    "key" in putResult &&
    typeof (putResult as { key?: unknown }).key === "string"
      ? (putResult as { key: string }).key
      : typeof putResult === "string"
        ? putResult
        : objectKey;

  const pictureFile = {
    name: objectKey,
    file: { bucket, region, key },
  };

  const created = await executeAppSyncGraphql<{
    createPicture: { id: string } | null;
  }>({
    query: CREATE_PICTURE,
    variables: { input: pictureFile },
    authWithUserPool: true,
  });

  const pictureId = created.data?.createPicture?.id;
  if (!pictureId) {
    throw new Error("Could not register your photo. Please try again.");
  }

  await executeAppSyncGraphql<{ updateUser: { id: string } }>({
    query: UPDATE_USER_HOST_PROFILE,
    variables: {
      input: {
        id: cognitoUserId,
        bio: input.bio.trim(),
        userType: "HOST",
        userProfilePicId: pictureId,
      },
    },
    authWithUserPool: true,
  });

  const display = input.lambdaDisplayName.trim() || "Host";

  const getStreamRaw = await raiseUserLambda(
    LambdaPayloadType.LOGIN,
    getStreamLambdaName(),
    {
      cognitoId: cognitoUserId,
      name: display,
    },
  );

  let getStreamParsed: { statusCode?: number; body?: unknown };
  try {
    getStreamParsed = JSON.parse(getStreamRaw) as {
      statusCode?: number;
      body?: unknown;
    };
  } catch {
    throw new Error("GetStream setup returned an unexpected response.");
  }

  if (getStreamParsed.statusCode !== 200) {
    throw new Error(
      "GetStream user setup did not complete successfully. Please try again or contact support.",
    );
  }

  await raiseUserLambda(LambdaPayloadType.LOGIN, usersLambdaName(), {
    userId: cognitoUserId,
    token: undefined,
  });

  let supportWired = false;
  let bootstrapThrew = false;
  try {
    supportWired = await bootstrapSupportChannelAfterEnrollment({
      cognitoUserId,
    });
  } catch {
    /* Support-channel bootstrap is best-effort (matches mobile
       `createSupportChannel` catch). On failure we mark
       `pendingSupportChannel` so the mobile `HomeBuddies` can retry. */
    bootstrapThrew = true;
    supportWired = false;
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (supportWired) {
        window.localStorage.removeItem(PENDING_SUPPORT_CHANNEL_KEY);
      } else if (bootstrapThrew) {
        /* Same spirit as mobile `AllSetNotification` flag — HomeBuddies can retry. */
        window.localStorage.setItem(PENDING_SUPPORT_CHANNEL_KEY, "true");
      } else {
        /* Lambda returned nothing to wire (`connectChannelSupport` empty) — mobile clears pending. */
        window.localStorage.removeItem(PENDING_SUPPORT_CHANNEL_KEY);
      }
      for (const k of ENROLLMENT_ANALYTICS_SEED_KEYS) {
        window.localStorage.setItem(k, "false");
      }
    }
  } catch {
    /* quota / private mode — same as mobile best-effort */
  }

  const buddyId = await fetchUserBuddyId(cognitoUserId);

  return {
    cognitoUserId,
    buddyId,
    supportChannelReady: supportWired,
    supportChannelDeferredToApp: bootstrapThrew,
  };
}
