import { redirect } from "next/navigation";
import { HOME_HREF } from "@/lib/navigation/appNav";

/**
 * Legacy entry point. The authenticated home is now the Groups tab (mirroring
 * the mobile app's landing tab), so anything still pointing at /dashboard is
 * forwarded there.
 */
export default function DashboardPage() {
  redirect(HOME_HREF);
}
