/**
 * GET  /api/admin/org/teams/[name]  — 팀 상세 (소속 근로자 목록)
 * PATCH /api/admin/org/teams/[name] — 팀 수정 (팀장·팀명 일괄 변경)
 *
 * [name] = URL-encoded teamName  (예: '철근팀' → '%EC%B2%A0%EA%B7%BC%ED%8C%80')
 * '__unassigned__' 특수 키 → teamName IS NULL 인원 조회
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  getAdminSession,
  requireFeature,
  requireRole,
  MUTATE_ROLES,
  buildWorkerScopeWhere,
} from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const patchSchema = z.object({
  newTeamName:    z.string().trim().min(1, '팀명은 1자 이상이어야 합니다.').max(50, '팀명은 50자 이하여야 합니다.').optional(),
  supervisorName: z.string().trim().max(20, '팀장 이름은 20자 이하여야 합니다.').nullable().optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireFeature(session, 'WORKER_VIEW')
    if (deny) return deny

    const { name } = await params
    const teamName = decodeURIComponent(name)
    const isUnassigned = teamName === '__unassigned__'

    const wrkScope = await buildWorkerScopeWhere(session)
    if (wrkScope === false) return ok({ teamName, workers: [] })

    const workers = await prisma.worker.findMany({
      where: {
        isActive: true,
        ...(wrkScope as object),
        ...(isUnassigned
          ? { OR: [{ teamName: null }, { teamName: '' }] }
          : { teamName }),
      },
      select: {
        id: true,
        name: true,
        teamName: true,
        supervisorName: true,
        foremanName: true,
        isActive: true,
        jobTitle: true,
        siteAssignments: {
          where: { isActive: true },
          select: { site: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: [{ foremanName: 'asc' }, { name: 'asc' }],
    })

    if (!isUnassigned && workers.length === 0) {
      return notFound('팀을 찾을 수 없습니다.')
    }

    // 고유 supervisorName / foremanName 추출
    const supervisorNames = Array.from(new Set(
      workers.map(w => w.supervisorName).filter((n): n is string => Boolean(n))
    ))
    const foremanNames = Array.from(new Set(
      workers.map(w => w.foremanName).filter((n): n is string => Boolean(n))
    ))

    return ok({
      teamName: isUnassigned ? null : teamName,
      workerCount: workers.length,
      supervisorNames,
      foremanNames,
      workers: workers.map(w => ({
        id:             w.id,
        name:           w.name,
        teamName:       w.teamName,
        supervisorName: w.supervisorName,
        foremanName:    w.foremanName,
        jobTitle:       w.jobTitle,
        siteName:       w.siteAssignments[0]?.site?.name ?? null,
      })),
    })
  } catch (err) {
    console.error('[org/teams/[name] GET]', err)
    return internalError()
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const denyFeature = requireFeature(session, 'WORKER_VIEW')
    if (denyFeature) return denyFeature
    const denyRole = requireRole(session, MUTATE_ROLES)
    if (denyRole) return denyRole

    const { name } = await params
    const teamName = decodeURIComponent(name)

    if (teamName === '__unassigned__') return badRequest('미배정 그룹은 수정할 수 없습니다.')

    const wrkScope = await buildWorkerScopeWhere(session)
    const scopeWhere = wrkScope === false ? { id: 'NONE' } : (wrkScope as object)

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { newTeamName, supervisorName } = parsed.data

    const updateData: Record<string, unknown> = {}
    if (newTeamName !== undefined)    updateData.teamName       = newTeamName
    if (supervisorName !== undefined) updateData.supervisorName = supervisorName

    if (Object.keys(updateData).length === 0) return badRequest('변경 항목이 없습니다.')

    const result = await prisma.$transaction(async (tx) => {
      const teamCount = await tx.worker.count({
        where: { teamName, isActive: true, ...scopeWhere },
      })
      if (teamCount === 0) return null

      if (newTeamName && newTeamName !== teamName) {
        const dup = await tx.worker.count({ where: { teamName: newTeamName, isActive: true } })
        if (dup > 0) throw new Error(`DUPLICATE:${newTeamName}`)
      }

      return tx.worker.updateMany({
        where: { teamName, isActive: true, ...scopeWhere },
        data:  updateData,
      })
    })

    if (result === null) return notFound('팀을 찾을 수 없습니다.')

    await writeAuditLog({
      actorUserId:  session.sub,
      actorType:    'ADMIN',
      actorRole:    session.role,
      actionType:   'UPDATE_TEAM',
      targetType:   'Team',
      targetId:     teamName,
      summary:      `팀 수정: ${teamName}${newTeamName ? ` → ${newTeamName}` : ''}${supervisorName !== undefined ? `, 팀장=${supervisorName}` : ''} (${result.count}명 일괄 반영)`,
      metadataJson: { teamName, newTeamName, supervisorName, count: result.count },
    })

    return ok({ updated: result.count, teamName: newTeamName ?? teamName })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('DUPLICATE:')) {
      return badRequest(`'${err.message.slice('DUPLICATE:'.length)}' 팀이 이미 존재합니다.`)
    }
    console.error('[org/teams/[name] PATCH]', err)
    return internalError()
  }
}
