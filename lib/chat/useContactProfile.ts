"use client";

import { useEffect, useState } from "react";
import { fetchContactProfile, type ContactProfile } from "./contactProfile";

/** Loads (and caches) a chat contact's profile: avatar, goal image, roles. */
export function useContactProfile(userId?: string | null): ContactProfile | null {
  const [profile, setProfile] = useState<ContactProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    fetchContactProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return profile;
}
