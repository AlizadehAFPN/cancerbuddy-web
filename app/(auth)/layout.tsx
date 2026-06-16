import AuthGuard from "@/components/auth/AuthGuard";

/**
 * Auth route-group layout (welcome "/" and "/login").
 * Each page owns its own visual layout; this only adds session gating:
 * <AuthGuard mode="guest"> sends already-signed-in users to the dashboard.
 * (Registration lives at /register, outside this group, so the resume flow
 * is unaffected.)
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard mode="guest" redirectTo="/groups">
      {children}
    </AuthGuard>
  );
}
