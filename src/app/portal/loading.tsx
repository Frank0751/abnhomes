/**
 * Shown the instant a link in the portal is clicked, while the page's data is
 * fetched. Without it the old page simply sat there until the new one was
 * ready, which reads as "nothing happened" and invites a second click.
 *
 * It mirrors the shape of a typical page — heading, a row of figures, a
 * panel — so the layout does not jump when the real content arrives.
 */
export default function PortalLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mx-auto h-8 w-56 rounded-md bg-black/[0.08]" />
      <div className="mx-auto mt-3 h-4 w-80 max-w-full rounded bg-black/[0.05]" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-black/[0.06] bg-white" />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-black/[0.06] bg-white p-5">
        <div className="h-5 w-40 rounded bg-black/[0.08]" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-md bg-black/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  )
}
