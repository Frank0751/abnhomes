/**
 * "One per line" text boxes — features, amenities, house rules — turned into
 * a clean list: blank lines and duplicates dropped, order kept, each line a
 * sensible length. Throws a message fit to show the person.
 */
export function lines(raw: string | undefined | null, max: number, label: string): string[] {
  const items = (raw ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const unique = [...new Set(items)]
  if (unique.length > max) throw new Error(`Keep ${label} to ${max} lines or fewer.`)
  for (const item of unique) {
    if (item.length > 120) throw new Error(`"${item.slice(0, 40)}…" is too long for ${label} — keep each line under 120 characters.`)
  }
  return unique
}
