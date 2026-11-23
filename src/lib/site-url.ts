/**
 * The site's public address, for links that leave the browser: receipts, the
 * pay-now link in a booking email, the portal link in a welcome SMS, the
 * "open in the console" button on a staff alert.
 *
 * Read at RUNTIME on every call, not inlined at build. That is the point of
 * this file. NEXT_PUBLIC_ variables are baked into the bundle when it is
 * built, so on Cloudflare a change of domain would have meant a rebuild with
 * the new value in the build settings. APP_URL is an ordinary variable: change
 * it in wrangler.jsonc or the dashboard and the next request uses it.
 *
 * Order of preference:
 *   APP_URL              set on Cloudflare
 *   AUTH_URL             if Auth.js has been pinned to an address, it is the right one
 *   NEXT_PUBLIC_APP_URL  what Vercel has always used
 *   the Vercel address   last resort, so a link is never "undefined/receipt/…"
 */
export function siteUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://abnhomes.vercel.app'
  // A trailing slash would give "https://…//portal" in every link.
  return raw.replace(/\/+$/, '')
}
