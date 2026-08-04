"use client";

/**
 * State for everything under /profile.
 *
 * One wide read backs the whole tab: the hub's completion rings score fields
 * that the individual edit screens own, so after any save the profile is
 * refetched and every ring re-derives from the same source. Keeping that in a
 * provider means moving between sections doesn't re-query.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSignedInUserId } from "@/lib/buddies/currentUser";
import { fetchOwnGallery, fetchOwnProfile } from "@/lib/profile/profileQueries";
import {
  canAccessProfile,
  sectionsFor,
  type GalleryPicture,
  type ProfileSections,
  type ProfileUser,
} from "@/lib/profile/types";

export type ProfileStatus = "loading" | "ready" | "error" | "forbidden";

interface ProfileContextValue {
  status: ProfileStatus;
  userId: string | null;
  user: ProfileUser | null;
  gallery: GalleryPicture[];
  /** Which hub sections this user type may see. */
  sections: ProfileSections;
  refresh: () => Promise<void>;
  refreshGallery: () => Promise<void>;
  retry: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  status: "loading",
  userId: null,
  user: null,
  gallery: [],
  sections: sectionsFor(null),
  refresh: async () => {},
  refreshGallery: async () => {},
  retry: () => {},
});

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}

export default function ProfileProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ProfileStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [gallery, setGallery] = useState<GalleryPicture[]>([]);
  const [attempt, setAttempt] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const id = await getSignedInUserId();
        if (cancelled || !mountedRef.current) return;
        setUserId(id);

        const [profile, pictures] = await Promise.all([
          fetchOwnProfile(id),
          fetchOwnGallery(id).catch(() => [] as GalleryPicture[]),
        ]);
        if (cancelled || !mountedRef.current) return;

        // Mobile never mounts this tab for a support account; the web mirrors
        // that by refusing the route rather than rendering a profile they were
        // not meant to manage.
        if (!canAccessProfile(profile?.userType)) {
          setStatus("forbidden");
          return;
        }

        setUser(profile);
        setGallery(pictures);
        setStatus("ready");
      } catch (err) {
        console.error("[profile] load failed:", err);
        if (!cancelled && mountedRef.current) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const profile = await fetchOwnProfile(userId);
      if (mountedRef.current) setUser(profile);
    } catch (err) {
      console.error("[profile] refresh failed:", err);
    }
  }, [userId]);

  const refreshGallery = useCallback(async () => {
    if (!userId) return;
    try {
      const pictures = await fetchOwnGallery(userId);
      if (mountedRef.current) setGallery(pictures);
    } catch (err) {
      console.error("[profile] gallery refresh failed:", err);
    }
  }, [userId]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const sections = useMemo(() => sectionsFor(user?.userType), [user?.userType]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      status,
      userId,
      user,
      gallery,
      sections,
      refresh,
      refreshGallery,
      retry,
    }),
    [status, userId, user, gallery, sections, refresh, refreshGallery, retry],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
