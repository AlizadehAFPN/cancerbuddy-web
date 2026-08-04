"use client";

/**
 * `/profile/journal` — the user's own journal.
 *
 * Each entry can be kept private or shown on the public profile. That switch is
 * the one destructive-feeling control here, so it states the resulting state in
 * words rather than relying on the toggle position alone, and confirms both
 * directions — mobile only announces going public.
 *
 * Editing happens inline. Mobile pushes a full-screen editor because a phone has
 * no room for a list and a text area at once; here the entry expands in place,
 * so the rest of the journal stays visible while writing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button, Textarea } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { ConfirmSheet } from "@/components/groups/GroupSheets";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  createJournalEntry,
  deleteJournalEntry,
  fetchMyJournal,
  setJournalVisibility,
  updateJournalText,
  type JournalEntry,
} from "@/lib/profile/journal";

function formatEntryDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function VisibilitySwitch({
  on,
  busy,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2.5 disabled:opacity-60"
    >
      <span
        className={[
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          on ? "bg-cb-black" : "bg-cb-gray-300",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            on ? "translate-x-[18px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
      <span className="font-body text-[12.5px] text-cb-gray-600">
        {t(on ? "app.profile.journalPublic" : "app.profile.journalPrivate")}
      </span>
    </button>
  );
}

export default function JournalScreen() {
  const router = useRouter();
  const { userId } = useProfile();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<JournalEntry | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const list = await fetchMyJournal(userId);
      if (mountedRef.current) {
        setEntries(list);
        setLoadError(false);
      }
    } catch (err) {
      console.error("[profile] journal load failed:", err);
      if (mountedRef.current) setLoadError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const publicCount = useMemo(
    () => entries.filter((e) => e.visibleToPublic).length,
    [entries],
  );

  const addEntry = useCallback(async () => {
    const text = draft.trim();
    if (!text || !userId || saving) return;
    setSaving(true);
    try {
      await createJournalEntry({ userId, text });
      setDraft("");
      setComposing(false);
      await load();
      toast.success(t("app.profile.journalAdded"));
    } catch (err) {
      console.error("[profile] journal create failed:", err);
      toast.error(t("app.profile.journalSaveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [draft, userId, saving, load]);

  const saveEdit = useCallback(async () => {
    const text = editText.trim();
    if (!text || !editingId || !userId || saving) return;
    setSaving(true);
    try {
      await updateJournalText({ userId, entryId: editingId, text });
      setEditingId(null);
      await load();
      toast.success(t("app.profile.journalUpdated"));
    } catch (err) {
      console.error("[profile] journal update failed:", err);
      toast.error(t("app.profile.journalSaveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [editText, editingId, userId, saving, load]);

  const toggleVisibility = useCallback(
    async (entry: JournalEntry, next: boolean) => {
      setBusyId(entry.id);
      // Optimistic — the switch must not lag behind the finger.
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, visibleToPublic: next } : e)),
      );
      try {
        await setJournalVisibility({ entryId: entry.id, visibleToPublic: next });
        toast.success(
          t(next ? "app.profile.journalNowPublic" : "app.profile.journalNowPrivate"),
        );
      } catch (err) {
        console.error("[profile] journal visibility failed:", err);
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, visibleToPublic: entry.visibleToPublic } : e,
          ),
        );
        toast.error(t("app.profile.journalSaveError"));
      } finally {
        if (mountedRef.current) setBusyId(null);
      }
    },
    [],
  );

  const remove = useCallback(async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await deleteJournalEntry(confirmDelete.id);
      setConfirmDelete(null);
      await load();
      toast.success(t("app.profile.journalDeleted"));
    } catch (err) {
      console.error("[profile] journal delete failed:", err);
      toast.error(t("app.profile.journalSaveError"));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }, [confirmDelete, load]);

  if (loading) {
    return (
      <div aria-hidden className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6 sm:px-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-cb-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          aria-label={t("app.profile.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
          {t("app.profile.journalTitle")}
        </h1>
      </header>

      <p className="mb-5 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.profile.journalIntro")}
        {entries.length > 0 && (
          <>
            {" "}
            <span className="text-cb-gray-500">
              {t("app.profile.journalPublicCount", {
                count: publicCount,
                total: entries.length,
              })}
            </span>
          </>
        )}
      </p>

      {/* Composer */}
      {composing ? (
        <div className="mb-5 rounded-2xl border border-cb-gray-200 bg-white p-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            autoFocus
            placeholder={t("app.profile.journalPlaceholder")}
          />
          <div className="mt-3 flex items-center justify-end gap-2.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setComposing(false);
                setDraft("");
              }}
              disabled={saving}
            >
              {t("app.profile.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={addEntry}
              disabled={!draft.trim()}
              loading={saving}
            >
              {t("app.profile.journalSave")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-5">
          <Button onClick={() => setComposing(true)}>
            {t("app.profile.addEntry")}
          </Button>
        </div>
      )}

      {loadError ? (
        <div className="rounded-2xl border border-cb-danger/30 bg-cb-danger/10 px-5 py-6 text-center">
          <p className="font-body text-[14px] text-cb-black">
            {t("app.profile.loadError")}
          </p>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              {t("app.profile.tryAgain")}
            </Button>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-cb-gray-200 bg-white px-6 py-16 text-center">
          <p className="font-heading text-[17px] font-bold text-cb-black">
            {t("app.profile.journalEmpty")}
          </p>
          <p className="mt-1.5 font-body text-[14px] text-cb-gray-500">
            {t("app.profile.journalEmptySub")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const editing = editingId === entry.id;
            return (
              <li
                key={entry.id}
                className="rounded-2xl border border-cb-gray-200 bg-white p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-body text-[12.5px] text-cb-gray-500">
                    {formatEntryDate(entry.createdAt)}
                  </span>
                  <VisibilitySwitch
                    on={entry.visibleToPublic}
                    busy={busyId === entry.id}
                    onChange={(next) => void toggleVisibility(entry, next)}
                  />
                </div>

                {editing ? (
                  <>
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={5}
                      autoFocus
                    />
                    <div className="mt-3 flex items-center justify-end gap-2.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                      >
                        {t("app.profile.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={!editText.trim()}
                        loading={saving}
                      >
                        {t("app.profile.journalSave")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="whitespace-pre-line font-body text-[15px] leading-relaxed text-cb-black">
                      {entry.text}
                    </p>
                    <div className="mt-3 flex items-center gap-3 border-t border-cb-gray-100 pt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(entry.id);
                          setEditText(entry.text);
                        }}
                        className="font-body text-[13px] font-semibold text-cb-gray-600 hover:text-cb-black"
                      >
                        {t("app.profile.journalEdit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(entry)}
                        className="font-body text-[13px] font-semibold text-cb-gray-600 hover:text-cb-danger"
                      >
                        {t("app.profile.journalDelete")}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title={t("app.profile.journalDelete")}
          body={t("app.profile.journalDeleteConfirm")}
          confirmLabel={t("app.profile.journalDelete")}
          danger
          busy={busyId === confirmDelete.id}
          onConfirm={remove}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
