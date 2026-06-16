/**
 * Resolve a presigned URL for an S3-stored image, mirroring the mobile app's
 * `getS3ImageUtil`. Profile pictures (and goal images) live in S3 and are
 * referenced by `{ bucket, key, region }`; Amplify `Storage.get` returns a
 * short-lived signed URL we can drop into an <img>.
 *
 * Cached in-memory with a TTL safely under S3's ~15-min signature window so we
 * never serve an expired URL and never re-sign the same key on every render.
 */

import { Storage } from "aws-amplify";
import { ensureAmplifyConfigured } from "./amplifyConfigure";

export interface S3FileRef {
  bucket?: string | null;
  key?: string | null;
  region?: string | null;
}

const TTL_MS = 14 * 60 * 1000;
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string | undefined>>();

export async function getS3ImageUrl(
  file?: S3FileRef | null,
): Promise<string | undefined> {
  if (!file?.key || !file?.bucket) return undefined;
  const key = file.key;

  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      ensureAmplifyConfigured();
      const url = (await Storage.get(key, { bucket: file.bucket! })) as string;
      cache.set(key, { url, exp: Date.now() + TTL_MS });
      return url;
    } catch {
      return undefined;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
