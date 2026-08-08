"use client";

/**
 * `/profile/lives` — hosts scheduling live sessions for their group.
 *
 * Mobile splits this across three screens (list, create, detail). With room to
 * work in, the list and the editor sit side by side: scheduling several sessions
 * is the common case, and going back to a list between each one is the slow part
 * of doing it on a phone.
 *
 * Sessions the host has hidden (`active: false`) stay reachable behind a filter
 * rather than disappearing, matching mobile's two tabs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button, Textarea } from "@/components/ui";
import { FieldLabel } from "@/components/ui/form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { ConfirmSheet } from "@/components/groups/GroupSheets";
import LiveScheduleField from "@/components/profile/LiveScheduleField";
import { hasSessionEnded } from "@/lib/live/session";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { UserType } from "@/lib/profile/types";
import { useVisibilityResync } from "@/lib/hooks/useVisibilityResync";
import {
  createLiveSession,
  deleteLiveSession,
  fetchHostGroupId,
  fetchLiveSession,
  fetchLiveSessions,
  formatTimestamp,
  formatSessionWhen,
  isoToLocalInput,
  localInputToIso,
  updateLiveSession,
  type LiveSession,
} from "@/lib/profile/manageLives";
import {
  DEFAULT_DURATION_CREATE,
  DEFAULT_DURATION_EDIT,
  scheduleBounds,
  scheduleProblem,
} from "@/lib/profile/liveSchedule";

type Editing =
  | { mode: "create" }
  | { mode: "edit"; session: LiveSession }
  | null;

function StatusPill({ session }: { session: LiveSession }) {
  if (session.inLive || session.status === "live") {
    return (
      <span className="rounded-full bg-cb-danger px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-white">
        {t("app.profile.liveNow")}
      </span>
    );
  }
  if (session.active === false) {
    return (
      <span className="rounded-full bg-cb-gray-200 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-gray-600">
        {t("app.profile.liveHidden")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-cb-bone px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-black">
      {t("app.profile.liveScheduled")}
    </span>
  );
}

export default function ManageLivesScreen() {
  const router = useRouter();
  const { userId, user, status } = useProfile();

  const [groupId, setGroupId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "hidden">("active");
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState<LiveSession | null>(null);
  const [saving, setSaving] = useState(false);

  /* Editor fields */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  /**
   * What the editor opened with. The guard rails describe a time the host is
   * *choosing*; a session already in the past, or one an admin created off the
   * 15-minute grid, must still be editable — otherwise renaming it becomes
   * impossible without rescheduling it.
   */
  const [openedWith, setOpenedWith] = useState("");
  const [duration, setDuration] = useState(DEFAULT_DURATION_CREATE);
  const [active, setActive] = useState(true);

  /**
   * The clock the schedule bounds are measured from. Read when the editor is
   * opened rather than on every render: a `new Date()` in the render body would
   * make the server's `min` differ from the client's.
   */
  const [now, setNow] = useState<Date | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isHost = user?.userType === UserType.HOST;

  const load = useCallback(async () => {
    if (!userId || !isHost) return;
    try {
      const hostGroup = await fetchHostGroupId(userId);
      if (!mountedRef.current) return;
      setGroupId(hostGroup);

      if (!hostGroup) {
        setSessions([]);
        return;
      }
      const list = await fetchLiveSessions(hostGroup);
      if (mountedRef.current) setSessions(list);
    } catch (err) {
      console.error("[profile] manage lives load failed:", err);
      toast.error(t("app.profile.loadError"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId, isHost]);

  useEffect(() => {
    void load();
  }, [load]);

  /* A session going live is flipped server-side by the first join, so a list
     left open all afternoon disagrees with reality. Re-read on return. */
  useVisibilityResync(load);

  const visible = useMemo(
    () =>
      sessions.filter((s) =>
        filter === "active" ? s.active !== false : s.active === false,
      ),
    [sessions, filter],
  );

  const hiddenCount = useMemo(
    () => sessions.filter((s) => s.active === false).length,
    [sessions],
  );

  const groupName = sessions[0]?.groupName ?? undefined;

  const openCreate = useCallback(() => {
    setNow(new Date());
    setEditing({ mode: "create" });
    setTitle("");
    setDescription("");
    setScheduledAt("");
    setOpenedWith("");
    setDuration(DEFAULT_DURATION_CREATE);
    setActive(true);
  }, []);

  const applySession = useCallback((session: LiveSession) => {
    setEditing({ mode: "edit", session });
    setTitle(session.title ?? "");
    setDescription(session.description ?? "");
    setScheduledAt(isoToLocalInput(session.scheduledAt));
    setOpenedWith(isoToLocalInput(session.scheduledAt));
    setDuration(Number(session.duration) || DEFAULT_DURATION_EDIT);
    setActive(session.active !== false);
  }, []);

  /**
   * Opens the editor on the row, then re-reads the session.
   *
   * The list can be minutes old — a co-host may have renamed the session, or it
   * may have gone live since — and editing a stale copy saves the stale values
   * back over the fresh ones. The row is shown immediately so the form is never
   * blank; the fetch replaces it when it lands.
   */
  const openEdit = useCallback(
    (session: LiveSession) => {
      setNow(new Date());
      applySession(session);
      void fetchLiveSession(session.id)
        .then((fresh) => {
          if (fresh && mountedRef.current) applySession(fresh);
        })
        .catch((err) =>
          console.error("[profile] live session refetch failed:", err),
        );
    },
    [applySession],
  );

  /**
   * `min` / `max` / `step` on the input are advisory outside a submitted form,
   * so the same rules gate Save. Without this a pasted or keyboard-typed value
   * still reaches the Lambda.
   */
  const bounds = useMemo(() => (now ? scheduleBounds(now) : null), [now]);
  const problem = useMemo(
    () =>
      now && scheduledAt !== openedWith
        ? scheduleProblem(scheduledAt, now)
        : null,
    [scheduledAt, openedWith, now],
  );

  const canSubmit =
    title.trim().length > 0 &&
    (editing?.mode === "edit" || scheduledAt.length > 0) &&
    !problem &&
    !saving;

  const submit = useCallback(async () => {
    if (!editing || !canSubmit) return;
    setSaving(true);
    try {
      if (editing.mode === "create") {
        if (!groupId) throw new Error("no host group");
        await createLiveSession({
          groupId,
          groupName,
          title: title.trim(),
          description: description.trim() || undefined,
          scheduledAt: localInputToIso(scheduledAt),
          duration,
        });
        toast.success(t("app.profile.liveCreated"));
      } else {
        await updateLiveSession({
          id: editing.session.id,
          title: title.trim(),
          description: description.trim() || undefined,
          duration,
          scheduledAt: localInputToIso(scheduledAt) || undefined,
          active,
        });
        toast.success(t("app.profile.liveUpdated"));
      }
      setEditing(null);
      await load();
    } catch (err) {
      console.error("[profile] live session save failed:", err);
      toast.error(
        err instanceof Error ? err.message : t("app.profile.liveSaveError"),
      );
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [
    editing,
    canSubmit,
    groupId,
    groupName,
    title,
    description,
    scheduledAt,
    duration,
    active,
    load,
  ]);

  const remove = useCallback(async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await deleteLiveSession(confirmDelete.id);
      setConfirmDelete(null);
      if (editing?.mode === "edit" && editing.session.id === confirmDelete.id) {
        setEditing(null);
      }
      await load();
      toast.success(t("app.profile.liveDeleted"));
    } catch (err) {
      console.error("[profile] live session delete failed:", err);
      toast.error(t("app.profile.liveSaveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [confirmDelete, editing, load]);

  /* Only hosts have sessions to manage. */
  if (status === "ready" && !isHost) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="font-heading text-[18px] font-bold text-cb-black">
          {t("app.profile.livesHostsOnly")}
        </p>
        <Button variant="secondary" onClick={() => router.push("/profile")}>
          {t("app.profile.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          aria-label={t("app.profile.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
            {t("app.profile.manageLives")}
          </h1>
          {groupName && (
            <p className="font-body text-[13px] text-cb-gray-500">{groupName}</p>
          )}
        </div>
        {groupId && (
          <Button size="sm" onClick={openCreate}>
            {t("app.profile.scheduleLive")}
          </Button>
        )}
      </header>

      {loading ? (
        <div aria-hidden className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-cb-gray-100" />
          ))}
        </div>
      ) : !groupId ? (
        <div className="rounded-2xl border border-cb-gray-200 bg-white px-6 py-16 text-center">
          <p className="font-heading text-[17px] font-bold text-cb-black">
            {t("app.profile.livesNoGroup")}
          </p>
          <p className="mt-1.5 font-body text-[14px] text-cb-gray-500">
            {t("app.profile.livesNoGroupSub")}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div>
            {hiddenCount > 0 && (
              <div className="mb-3 flex gap-1 rounded-xl bg-cb-gray-100 p-1">
                {(["active", "hidden"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={[
                      "flex-1 rounded-lg px-3 py-1.5 font-body text-[13px] font-semibold transition-colors",
                      filter === key
                        ? "bg-white text-cb-black shadow-sm"
                        : "text-cb-gray-600 hover:text-cb-black",
                    ].join(" ")}
                  >
                    {t(
                      key === "active"
                        ? "app.profile.livesVisible"
                        : "app.profile.livesHiddenTab",
                    )}
                  </button>
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="rounded-2xl border border-cb-gray-200 bg-white px-6 py-14 text-center">
                <p className="font-heading text-[16px] font-bold text-cb-black">
                  {t("app.profile.livesEmpty")}
                </p>
                <p className="mt-1.5 font-body text-[13.5px] text-cb-gray-500">
                  {t("app.profile.livesEmptySub")}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((session) => {
                  const open =
                    editing?.mode === "edit" && editing.session.id === session.id;
                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => openEdit(session)}
                        className={[
                          "w-full rounded-2xl border bg-white p-4 text-left transition-all",
                          open
                            ? "border-cb-black shadow-[0_6px_24px_-10px_rgba(36,36,36,0.25)]"
                            : "border-cb-gray-200 hover:border-cb-gray-400",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 font-heading text-[15.5px] font-bold text-cb-black">
                            {session.title}
                          </span>
                          <StatusPill session={session} />
                        </div>
                        <p className="mt-1 font-body text-[13px] text-cb-gray-600">
                          {formatSessionWhen(session)}
                        </p>
                        {session.description && (
                          <p className="mt-1.5 line-clamp-2 font-body text-[13.5px] leading-snug text-cb-gray-500">
                            {session.description}
                          </p>
                        )}
                      </button>

                      {/*
                        A host had no way to *start* their own session: the row
                        only opened the editor and the LIVE NOW pill was plain
                        text. `inLive` is flipped by the first host joining, so
                        gating this on live state would make starting a session
                        impossible. Sibling of the button, not a child — an
                        anchor inside a button is invalid HTML.
                      */}
                      {!hasSessionEnded(session) && (
                        <div className="mt-1.5 flex justify-end">
                          <Link
                            href={`/live/${session.id}`}
                            className={
                              session.inLive || session.status === "live"
                                ? "rounded-full bg-cb-danger px-4 py-1.5 font-body text-[12.5px] font-bold text-white transition-[filter] hover:brightness-110"
                                : "rounded-full border-2 border-cb-black px-3.5 py-1.5 font-body text-[12.5px] font-bold text-cb-black transition-colors hover:bg-cb-gray-100"
                            }
                          >
                            {session.inLive || session.status === "live"
                              ? t("app.groups.joinLive")
                              : t("app.groups.openSession")}
                          </Link>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Editor */}
          {editing && (
            <aside className="h-fit rounded-2xl border border-cb-gray-200 bg-white p-5 lg:sticky lg:top-4">
              <h2 className="font-heading text-[13px] font-bold uppercase tracking-[0.12em] text-cb-black">
                {t(
                  editing.mode === "create"
                    ? "app.profile.scheduleLive"
                    : "app.profile.editLive",
                )}
              </h2>

              {/*
                When the session was created and last changed. A host with
                several similar sessions has no other way to tell which one they
                edited last, and mobile prints both on its detail screen.
              */}
              {editing.mode === "edit" && (
                <dl className="mt-2 space-y-0.5 font-body text-[12px] text-cb-gray-500">
                  {editing.session.createdAt && (
                    <div className="flex gap-1.5">
                      <dt>{t("app.profile.liveCreatedAt")}</dt>
                      <dd>{formatTimestamp(editing.session.createdAt)}</dd>
                    </div>
                  )}
                  {editing.session.updatedAt && (
                    <div className="flex gap-1.5">
                      <dt>{t("app.profile.liveUpdatedAt")}</dt>
                      <dd>{formatTimestamp(editing.session.updatedAt)}</dd>
                    </div>
                  )}
                </dl>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <FieldLabel>{t("app.profile.liveTitle")}</FieldLabel>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("app.profile.liveTitlePlaceholder")}
                    className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 hover:border-cb-gray-400 focus:border-cb-black"
                  />
                </div>

                <div>
                  <FieldLabel>{t("app.profile.liveDescription")}</FieldLabel>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder={t("app.profile.liveDescriptionPlaceholder")}
                  />
                </div>

                <LiveScheduleField
                  scheduledAt={scheduledAt}
                  duration={duration}
                  bounds={bounds}
                  problem={problem}
                  onScheduledAtChange={setScheduledAt}
                  onDurationChange={setDuration}
                />

                {editing.mode === "edit" && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-cb-gray-100 p-3">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-cb-black"
                    />
                    <span className="min-w-0">
                      <span className="block font-body text-[14px] font-semibold text-cb-black">
                        {t("app.profile.liveVisibleToMembers")}
                      </span>
                      <span className="mt-0.5 block font-body text-[12.5px] leading-snug text-cb-gray-500">
                        {t("app.profile.liveVisibleHint")}
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                {editing.mode === "edit" ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(editing.session)}
                    className="font-body text-[13px] font-semibold text-cb-gray-600 hover:text-cb-danger"
                  >
                    {t("app.profile.liveDelete")}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                    disabled={saving}
                  >
                    {t("app.profile.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={submit}
                    disabled={!canSubmit}
                    loading={saving}
                  >
                    {t("app.profile.save")}
                  </Button>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title={t("app.profile.liveDelete")}
          body={t("app.profile.liveDeleteConfirm", { title: confirmDelete.title })}
          confirmLabel={t("app.profile.liveDelete")}
          danger
          busy={saving}
          onConfirm={remove}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
