/**
 * Shared helper for uploading a photo file to S3 and registering it as a
 * `Picture` record in AppSync. Used by StepProfilePic and StepPhotos during
 * the user registration flow.
 *
 * Mirrors the same pipeline used in `hostEnrollmentFinalize.ts` —
 * S3 `Storage.put()` → AppSync `createPicture`.
 */

import { Auth, Storage } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { PHOTO_MAX_BYTES } from "@/lib/host-signup/constants";

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

function s3BucketConfig(): { bucket: string; region: string } {
  const bucket = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET?.trim();
  const region = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION?.trim();
  if (!bucket || !region) {
    throw new Error(
      "S3 bucket config missing. Set NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET and NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION.",
    );
  }
  return { bucket, region };
}

function newObjectKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${c.randomUUID()}.jpg`;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
}

/**
 * Uploads a JPEG `File` to S3, creates a `Picture` record in AppSync, and
 * returns the new picture's AppSync `id`.
 *
 * Throws if the file is empty, too large, or if either the S3 upload or the
 * AppSync mutation fails.
 */
export async function uploadPhotoAndCreatePicture(file: File): Promise<string> {
  ensureAmplifyConfigured();

  // Re-validate the file here as a defence-in-depth check.
  if (!file || file.size === 0) {
    throw new Error("The photo file appears to be empty. Please choose another.");
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new Error("The photo is too large. Please choose a smaller image.");
  }

  // Verify the user is still signed in before touching S3.
  await Auth.currentAuthenticatedUser({ bypassCache: false });

  const { bucket, region } = s3BucketConfig();
  const objectKey = newObjectKey();

  const putResult = await Storage.put(objectKey, file, {
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

  const created = await executeAppSyncGraphql<{
    createPicture: { id: string } | null;
  }>({
    query: CREATE_PICTURE,
    variables: {
      input: {
        name: objectKey,
        file: { bucket, region, key },
      },
    },
    authWithUserPool: true,
  });

  const pictureId = created.data?.createPicture?.id;
  if (!pictureId) {
    throw new Error("Could not register your photo. Please try again.");
  }

  return pictureId;
}
