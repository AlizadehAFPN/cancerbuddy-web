/**
 * Profile gallery photos.
 *
 * A photo is an S3 object plus a `Picture` row. What ties it to its owner is
 * `userGalleryId` on that row — set at creation and used as the gallery's
 * filter. The signup upload helper doesn't set it (a profile picture is linked
 * from the user row instead), which is why gallery uploads go through here.
 */

import { Auth, Storage } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

/** Mobile's `MAX_IMAGES_GALLERY`. */
export const MAX_GALLERY_PHOTOS = 6;

/** Generous ceiling; the browser re-encodes to JPEG well below it. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const CREATE_PICTURE = /* GraphQL */ `
  mutation addGalleryPicture($input: CreatePictureInput!) {
    createPicture(input: $input) {
      id
      file {
        bucket
        region
        key
      }
    }
  }
`;

const DELETE_PICTURE = /* GraphQL */ `
  mutation deleteGalleryPicture($input: DeletePictureInput!) {
    deletePicture(input: $input) {
      id
    }
  }
`;

const UPDATE_PROFILE_PICTURE = /* GraphQL */ `
  mutation updateUserProfilePic($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

function s3BucketConfig(): { bucket: string; region: string } {
  const bucket = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET?.trim();
  const region = process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION?.trim();
  if (!bucket || !region) {
    throw new Error("S3 bucket config missing.");
  }
  return { bucket, region };
}

function newObjectKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${c.randomUUID()}.jpg`;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
}

/**
 * Re-encodes an image to JPEG, bounded to `maxEdge`.
 *
 * Phone cameras produce files far larger than a profile gallery needs, and a
 * browser upload has no native compression step the way the mobile picker does.
 * Doing it here keeps uploads quick and the stored objects a sane size.
 */
async function toJpegFile(file: File, maxEdge = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86),
  );
  return blob ?? file;
}

/**
 * Uploads one photo and attaches it to the user's gallery.
 * Returns the new `Picture` id.
 */
export async function uploadGalleryPhoto(params: {
  userId: string;
  file: File;
}): Promise<string> {
  ensureAmplifyConfigured();

  if (!params.file || params.file.size === 0) {
    throw new Error("That file appears to be empty.");
  }
  if (params.file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That photo is too large.");
  }

  await Auth.currentAuthenticatedUser({ bypassCache: false });

  const { bucket, region } = s3BucketConfig();
  const objectKey = newObjectKey();
  const body = await toJpegFile(params.file);

  const putResult = await Storage.put(objectKey, body, {
    contentType: "image/jpeg",
  });

  const key =
    putResult && typeof putResult === "object" && "key" in putResult
      ? String((putResult as { key: unknown }).key)
      : objectKey;

  const { data } = await executeAppSyncGraphql<{
    createPicture: { id: string } | null;
  }>({
    query: CREATE_PICTURE,
    variables: {
      input: {
        // This is what puts the photo in *this* user's gallery.
        userGalleryId: params.userId,
        name: objectKey,
        file: { bucket, region, key },
      },
    },
    authWithUserPool: true,
  });

  const id = data?.createPicture?.id;
  if (!id) throw new Error("Could not register that photo.");
  return id;
}

export async function deleteGalleryPhoto(pictureId: string): Promise<void> {
  await executeAppSyncGraphql({
    query: DELETE_PICTURE,
    variables: { input: { id: pictureId } },
    authWithUserPool: true,
  });
}

/**
 * Uploads a new profile picture and points the user row at it.
 *
 * Unlike gallery photos this one is *not* given a `userGalleryId` — mobile
 * keeps the avatar out of the gallery listing, and copying that keeps the
 * gallery count (and its completion ring) consistent between clients.
 */
export async function setProfilePicture(params: {
  userId: string;
  file: File;
}): Promise<string> {
  ensureAmplifyConfigured();
  await Auth.currentAuthenticatedUser({ bypassCache: false });

  const { bucket, region } = s3BucketConfig();
  const objectKey = newObjectKey();
  const body = await toJpegFile(params.file, 1024);

  const putResult = await Storage.put(objectKey, body, {
    contentType: "image/jpeg",
  });
  const key =
    putResult && typeof putResult === "object" && "key" in putResult
      ? String((putResult as { key: unknown }).key)
      : objectKey;

  const { data } = await executeAppSyncGraphql<{
    createPicture: { id: string } | null;
  }>({
    query: CREATE_PICTURE,
    variables: {
      input: { name: objectKey, file: { bucket, region, key } },
    },
    authWithUserPool: true,
  });

  const pictureId = data?.createPicture?.id;
  if (!pictureId) throw new Error("Could not register that photo.");

  await executeAppSyncGraphql({
    query: UPDATE_PROFILE_PICTURE,
    variables: { input: { id: params.userId, userProfilePicId: pictureId } },
    authWithUserPool: true,
  });

  return pictureId;
}

/** Clears the avatar: unlinks it from the user, then deletes the record. */
export async function removeProfilePicture(params: {
  userId: string;
  pictureId: string;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: UPDATE_PROFILE_PICTURE,
    variables: { input: { id: params.userId, userProfilePicId: null } },
    authWithUserPool: true,
  });
  await deleteGalleryPhoto(params.pictureId);
}
