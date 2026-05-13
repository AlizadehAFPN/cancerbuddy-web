import type { NextConfig } from "next";

/**
 * Global security headers. We apply them via `headers()` instead of the
 * middleware/proxy so they ship with every response — static assets, error
 * pages, and rewrites included — and don't depend on a particular handler
 * being hit.
 *
 * Notes:
 *  - We do not set a `Content-Security-Policy` here yet. Amplify's runtime
 *    needs to talk to `*.amazoncognito.com`, `*.appsync-api.<region>.amazonaws.com`,
 *    `*.amazonaws.com` (S3 + Lambda), and the Cognito Identity Pool, and the
 *    bundled SDK uses `wasm-unsafe-eval` in some paths. A too-strict CSP will
 *    silently break the host-register flow. When you're ready to add a CSP,
 *    start in `Content-Security-Policy-Report-Only` mode and tighten over a
 *    few production days.
 *  - HSTS is set with a 2-year max-age and `includeSubDomains`. Only enable
 *    `preload` once you've confirmed the apex + every subdomain serves
 *    HTTPS, otherwise you're committing browsers to a setup you can't
 *    reverse.
 */
const SECURITY_HEADERS = [
  /* Force HTTPS for two years on this host and every subdomain.
     Browsers receive this only on HTTPS responses — local `next dev` over
     HTTP simply ignores it. */
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  /* Don't let the browser MIME-sniff e.g. a misdetected image to text/html. */
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  /* Same intent as `frame-ancestors 'none'` in CSP — prevent clickjacking
     by disallowing the site from being framed. */
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  /* Only send the origin (no path / query) on cross-origin requests so the
     full signup URL — `?step=...` — does not leak in `Referer` to third
     parties. Same-origin navigations still get the full URL. */
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  /* Disable browser features we don't use. Reduces the blast radius of an
     XSS or rogue dependency embedding a microphone / camera capture. The
     photo upload is a normal `<input type="file">`, not `getUserMedia`. */
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  /* Reduce data sent to third parties by default; the only cross-origin
     callers we expect are AWS endpoints, which don't read these. */
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  /**
   * Next.js 16 blocks "cross-origin" dev-server resources by default
   * (HMR socket, React refresh runtime, RSC flight stream). When you load
   * the dev server from another device on the LAN — e.g. testing on a
   * phone via `http://192.168.1.x:3000` — those requests come in with a
   * cross-origin `Origin` header and Next refuses them. The page's HTML
   * still renders, but the React-refresh runtime never installs, so
   * `onClick` handlers are never wired up: buttons show their CSS press
   * state (`active:bg-*`) but their handlers don't fire. Native `<a>`
   * links keep working because they don't need React.
   *
   * Allow-list the LAN IPs you use to test from. We allow the whole
   * private RFC 1918 ranges in dev so any phone / tablet on the same
   * Wi-Fi can hit the dev server without each developer maintaining a
   * personal allow-list. In production this option is a no-op.
   */
  /* Patterns: Next.js matches `allowedDevOrigins` segment-by-segment on `.`
     (see `csrf-protection.ts` in next), so we use dotted wildcards rather
     than CIDR. These cover every private IPv4 range (RFC 1918) plus
     loopback and `*.local` mDNS hostnames — i.e. every host you'd
     plausibly reach a Mac dev server from on the same LAN. */
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.local",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
