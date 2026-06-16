import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/app-shell/AppShell";
import StreamChatProvider from "@/lib/chat/StreamChatProvider";

/**
 * Authenticated app layout.
 *
 *  • <AuthGuard mode="protected"> redirects to "/" when there is no valid
 *    Cognito session (tokens live in localStorage, so this is checked
 *    client-side rather than in the proxy).
 *  • <AppShell> is the responsive navigation chrome: a left sidebar on desktop,
 *    a bottom tab bar on mobile, and a shared account menu — the web port of
 *    the mobile bottom-tab + hamburger-drawer navigation.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard mode="protected" redirectTo="/">
      <StreamChatProvider>
        <AppShell>{children}</AppShell>
      </StreamChatProvider>
    </AuthGuard>
  );
}
