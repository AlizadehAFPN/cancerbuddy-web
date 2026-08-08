import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/app-shell/AppShell";
import StreamChatProvider from "@/lib/chat/StreamChatProvider";
import PushBridge from "@/components/push/PushBridge";
import AppStatusGate from "@/components/app-status/AppStatusGate";
import UnsavedChangesProvider from "@/lib/navigation/UnsavedChangesProvider";
import AccountProvider from "@/lib/account/AccountProvider";
import SnoozeGate from "@/components/account/SnoozeGate";

/**
 * Authenticated app layout.
 *
 *  • <AuthGuard mode="protected"> redirects to "/" when there is no valid
 *    Cognito session (tokens live in localStorage, so this is checked
 *    client-side rather than in the proxy).
 *  • <AppShell> is the responsive navigation chrome: a left sidebar on desktop,
 *    a bottom tab bar on mobile, and a shared account menu — the web port of
 *    the mobile bottom-tab + hamburger-drawer navigation.
 *  • <AppStatusGate> is the ops kill switch and the offline notice. It gates
 *    every authenticated screen, the way mobile gates its navigators, and fails
 *    open on every error path.
 *  • <UnsavedChangesProvider> asks before an in-app navigation abandons a
 *    half-finished form. Wraps the shell so sidebar and bottom-bar links are
 *    covered as well as the forms' own back arrows.
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
      <AccountProvider>
        <AppStatusGate>
        <UnsavedChangesProvider>
          <StreamChatProvider>
            <PushBridge />
            {/*
              Every authenticated screen renders through the snooze gate, so a
              route added later cannot bypass it by forgetting to opt in — the
              same reason mobile gates its navigators rather than its screens.
            */}
            <AppShell>
              <SnoozeGate>{children}</SnoozeGate>
            </AppShell>
          </StreamChatProvider>
        </UnsavedChangesProvider>
        </AppStatusGate>
      </AccountProvider>
    </AuthGuard>
  );
}
