/**
 * Auth route-group layout.
 * Transparent pass-through — every auth page owns its own layout completely.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
