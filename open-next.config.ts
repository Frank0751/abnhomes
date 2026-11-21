import { defineCloudflareConfig } from '@opennextjs/cloudflare'

/**
 * OpenNext's build configuration for Cloudflare.
 *
 * Deliberately minimal. Almost every page here is rendered per request from
 * live data — availability, balances, the room board — so there is little for
 * an incremental cache to hold. R2-backed caching can be added later if
 * profiling shows the static pages need it.
 */
export default defineCloudflareConfig({})
