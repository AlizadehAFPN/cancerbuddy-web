"use client";

import ProfileProvider, { useProfile } from "@/lib/profile/ProfileProvider";
import ProfileForbidden from "@/components/profile/ProfileForbidden";

/**
 * Everything under /profile shares one read of the user.
 *
 * The gate is here rather than per-page because mobile withholds the whole tab
 * from support accounts, not individual screens — so no route below this point
 * should render for them.
 */
function ProfileGate({ children }: { children: React.ReactNode }) {
  const { status } = useProfile();
  if (status === "forbidden") return <ProfileForbidden />;
  return <>{children}</>;
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <ProfileGate>{children}</ProfileGate>
    </ProfileProvider>
  );
}
