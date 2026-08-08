import { Auth, Storage } from "aws-amplify";

import { ensureAmplifyConfigured } from "./amplifyConfigure";
import type { S3FileRef } from "./s3Image";

/**
 * Uploading to the user-files bucket.
 *
 * The signup photo path grew its own copy of this; feed and chat media need the
 * same three steps, so it lives here once. `Storage.put` returns either a
 * `{key}` object or a bare string depending on the Amplify version, which is the
 * only fiddly part.
 */
export function s3BucketConfig(): { bucket: string; region: string } {
  const bucket = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET?.trim();
  const region = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION?.trim();
  if (!bucket || !region) {
    throw new Error(
      "S3 bucket config missing. Set NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET and NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION.",
    );
  }
  return { bucket, region };
}

/** A random object key with the given extension, matching mobile's `uuid.ext`. */
export function newObjectKey(extension: string): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return `${uuid}.${extension}`;
}

function keyOf(putResult: unknown, fallback: string): string {
  if (putResult && typeof putResult === "object" && "key" in putResult) {
    const k = (putResult as { key?: unknown }).key;
    if (typeof k === "string") return k;
  }
  return typeof putResult === "string" ? putResult : fallback;
}

/**
 * Uploads a file and returns the object reference to persist.
 *
 * The reference — not a URL — is what gets stored, because presigned URLs expire
 * in minutes. Callers sign one at render time instead.
 */
export async function uploadToUserFiles(
  file: Blob,
  options: { extension: string; contentType?: string },
): Promise<S3FileRef & { key: string; bucket: string; region: string }> {
  ensureAmplifyConfigured();
  // Confirms the session is still valid before spending an upload on it.
  await Auth.currentAuthenticatedUser({ bypassCache: false });

  const { bucket, region } = s3BucketConfig();
  const objectKey = newObjectKey(options.extension);

  const putResult = await Storage.put(objectKey, file, {
    ...(options.contentType ? { contentType: options.contentType } : {}),
  });

  return { bucket, region, key: keyOf(putResult, objectKey) };
}
