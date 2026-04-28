/**
 * Authenticated app layout — placeholder for future navigation chrome.
 *
 * When this layout grows it will contain:
 *  • Top navigation bar
 *  • Bottom tab bar (matching the mobile drawer/tab navigator)
 *  • Session guard (redirect to "/" if unauthenticated)
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-white">
      {/* TODO: <AppNav /> */}
      <main className="flex flex-col flex-1">{children}</main>
      {/* TODO: <AppTabBar /> */}
    </div>
  );
}
