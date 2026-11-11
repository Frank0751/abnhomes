import type { NextRequest } from 'next/server'
import { currentActor, requirePermission } from '@/lib/session'
import { portfolioReport, reportToCsv } from '@/lib/reporting/analytics'

export const dynamic = 'force-dynamic'

/** CSV export of the portfolio report. Same numbers as the screen shows. */
export async function GET(request: NextRequest) {
  const actor = await currentActor()
  if (!actor) return new Response('Unauthorized', { status: 401 })
  try {
    await requirePermission('reports:read')
  } catch {
    return new Response('Forbidden', { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const from = sp.get('from') ? new Date(sp.get('from')!) : new Date(Date.now() - 30 * 86_400_000)
  const to = sp.get('to') ? new Date(sp.get('to')!) : new Date()
  const propertyId = sp.get('propertyId') ?? undefined

  const report = await portfolioReport({ from, to, propertyId })
  const csv = reportToCsv(report)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="abn-report-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`,
    },
  })
}
