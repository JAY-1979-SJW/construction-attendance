/**
 * GET /api/admin/org/teams
 * 조직 팀 목록 — teamName 기준 집계
 *
 * 반환: 팀별 인원수, supervisorName(팀장), 고유 foremanName 목록
 * 역할 scope: TEAM_LEADER → 자기 팀만, FOREMAN → 자기 담당 팀만
 */
import { NextRequest } from 'next/server'
import { getAdminSession, requireFeature, buildWorkerScopeWhere } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireFeature(session, 'WORKER_VIEW')
    if (deny) return deny

    const wrkScope = await buildWorkerScopeWhere(session)
    if (wrkScope === false) return ok({ teams: [], unassignedCount: 0 })

    const workers = await prisma.worker.findMany({
      where: { isActive: true, ...(wrkScope as object) },
      select: {
        id: true,
        name: true,
        teamName: true,
        supervisorName: true,
        foremanName: true,
      },
    })

    // 팀별 집계
    const teamMap = new Map<string, {
      teamName: string
      workerCount: number
      supervisorNames: Set<string>
      foremanNames: Set<string>
    }>()

    let unassignedCount = 0

    for (const w of workers) {
      if (!w.teamName) {
        unassignedCount++
        continue
      }
      if (!teamMap.has(w.teamName)) {
        teamMap.set(w.teamName, {
          teamName: w.teamName,
          workerCount: 0,
          supervisorNames: new Set(),
          foremanNames: new Set(),
        })
      }
      const entry = teamMap.get(w.teamName)!
      entry.workerCount++
      if (w.supervisorName) entry.supervisorNames.add(w.supervisorName)
      if (w.foremanName)    entry.foremanNames.add(w.foremanName)
    }

    const teams = Array.from(teamMap.values())
      .map(t => ({
        teamName:       t.teamName,
        workerCount:    t.workerCount,
        supervisorName: t.supervisorNames.size > 0 ? Array.from(t.supervisorNames).join(', ') : null,
        foremanNames:   Array.from(t.foremanNames),
      }))
      .sort((a, b) => b.workerCount - a.workerCount)

    return ok({ teams, unassignedCount })
  } catch (err) {
    console.error('[org/teams GET]', err)
    return internalError()
  }
}
