"use client";

/**
 * The group or post a message refers to.
 *
 * Two message types carry one: `AskToHost`, sent when someone asks a private
 * group's host for the code, and `ReplyHost`, when a host replies privately
 * about a post. Web dropped both in `mapAttachments`, so the message arrived as
 * a bare sentence with nothing to act on — and when it had no text at all, the
 * empty-body filter removed it entirely and the member saw nothing.
 *
 * Labels are mobile's, verbatim: `GO TO GROUP`, `GO TO COMMENT`,
 * `COMMENT NOT FOUND`.
 */

import Link from "next/link";

import { t } from "@/lib/i18n";
import { sanitizePostHtml } from "@/lib/groups/sanitizeHtml";
import type { UIContextAttachment } from "@/lib/chat/useChannelMessages";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 max-w-[22rem] rounded-2xl border border-cb-gray-200 bg-white p-3.5">
      {children}
    </div>
  );
}

function JumpLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-2 inline-flex items-center gap-1 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-cb-black hover:underline"
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

export default function ContextAttachment({
  attachment,
}: {
  attachment: UIContextAttachment;
}) {
  if (attachment.type === "askToHost") {
    const group = attachment.group;
    if (!group?.id) return null;
    return (
      <Card>
        <p className="font-heading text-[15px] font-bold text-cb-black">
          {group.name ?? t("app.chat.contextGroup")}
        </p>
        {group.description && (
          <p className="mt-1 line-clamp-3 font-body text-[13.5px] leading-snug text-cb-gray-600">
            {group.description}
          </p>
        )}
        <JumpLink href={`/groups/${group.id}`} label={t("app.chat.goToGroup")} />
      </Card>
    );
  }

  const post = attachment.post;

  /**
   * The post the message quoted is gone — deleted, or in a group the reader
   * cannot see. Mobile shows the same words rather than a dead button.
   */
  if (!post?.id || !post.feedId) {
    return (
      <Card>
        <p className="py-3 text-center font-body text-[12.5px] font-bold uppercase tracking-[0.08em] text-cb-gray-500">
          {t("app.chat.commentNotFound")}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      {post.object ? (
        <div
          className="line-clamp-4 font-body text-[13.5px] leading-snug text-cb-black [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.object) }}
        />
      ) : (
        <p className="font-body text-[13.5px] text-cb-gray-500">
          {t("app.chat.contextPost")}
        </p>
      )}
      <JumpLink
        href={`/groups/${post.feedId}?post=${post.id}`}
        label={t("app.chat.goToComment")}
      />
    </Card>
  );
}
