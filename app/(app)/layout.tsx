import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/app-shell/AppShell";
import StreamChatProvider from "@/lib/chat/StreamChatProvider";
import PushBridge from "@/components/push/PushBridge";

/**
 * Authenticated app layout.
 *
 *  • <AuthGuard mode="protected"> redirects to "/" when there is no valid
 *    Cognito session (tokens live in localStorage, so this is checked
 *    client-side rather than in the proxy).
 *  • <AppShell> is the responsive navigation chrome: a left sidebar on desktop,
 *    a bottom tab bar on mobile, and a shared account menu — the web port of
 *    the mobile bottom-tab + hamburger-drawer navigation.
 *  • <PushBridge> keeps the browser's FCM token registered with Stream and
 *    toasts notifications that arrive while a tab is focused. Renders nothing
 *    and never prompts for permission — that lives in /settings.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard mode="protected" redirectTo="/">
      <StreamChatProvider>
        <PushBridge />
        <AppShell>{children}</AppShell>
      </StreamChatProvider>
    </AuthGuard>
  );
}
