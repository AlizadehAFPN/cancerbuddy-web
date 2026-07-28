/**
 * Stream Chat custom-field augmentation.
 *
 * `ChannelData` only allows fields declared in Stream's `CustomChannelData`
 * slot. Our channels carry a `name` — set when a buddy connection is accepted,
 * on both mobile and web — and chat search autocompletes against it, so it has
 * to be part of the type rather than cast away at each call site.
 */

import "stream-chat";

declare module "stream-chat" {
  interface CustomChannelData {
    /** "<their first name> <my first name>", written when the channel is created. */
    name?: string;
  }
}
