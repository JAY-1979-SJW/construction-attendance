import { NextResponse } from 'next/server'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

type Severity = 'LOW' | 'MEDIUM' | 'HIGH'

interface AnomalyEvent {
  type:
    | 'duplicate_device'
    | 'bulk_approval'
    | 'night_approval'
    | 'bulk_work_edit'
    | 'night_work_edit'
    | 'pre_settlement_edit'
    | 'repeated_work_edit'
  description: string
  companyName: string
  adminName: string
  workerName: string
  deviceInfo: string
  occurredAt: string
  severity: Severity
}

const severityOrder: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/**
 * GET /api/admin/devices/anomalies
 * 이상행위 탐지 — SUPER_ADMIN 전용
 * 탐지 범위: 기기 승인 이상 + 공수 수정 이상
 */
export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const anomalies: AnomalyEvent[] = []

    // ══════════════════════════════════════════════════
    //  A. 기기 승인 이상행위
    // ══════════════════════════════════════════════════
    const requests = await prisma.deviceChangeRequest.findMany({
      where: { status: 'APPROVED', processedAt: { gte: since } },
      include: {
        worker: { select: { id: true, name: true } },
        adminUser: {
          select: {
            id: true,
            name: true,
            company: { select: { companyName: true } },
          },
        },
      },
      orderBy: { processedAt: 'asc' },
    })

    // A-1. 동일 기기 지문 다중 사용자
    const tokenWorkerMap = new Map<string, Set<string>>()
    const tokenRequestMap = new Map<string, typeof requests>()
    for (const req of requests) {
      const fp = req.newDeviceToken.slice(0, 8)
      if (!tokenWorkerMap.has(fp)) {
        tokenWorkerMap.set(fp, new Set())
        tokenRequestMap.set(fp, [])
      }
      tokenWorkerMap.get(fp)!.add(req.workerId)
      tokenRequestMap.get(fp)!.push(req)
    }
    for (const entry of Array.from(tokenWorkerMap.entries())) {
      const [fp, workerIds] = entry
      if (workerIds.size >= 2) {
        const rels = tokenRequestMap.get(fp)!
        const latest = rels[rels.length - 1]
        anomalies.push({
          type: 'duplicate_device',
          description: `기기 지문 [${fp}***]이 ${workerIds.size}명 근로자에 중복 사용됨`,
          companyName: latest.adminUser?.company?.companyName ?? '알 수 없음',
          adminName:   latest.adminUser?.name ?? '알 수 없음',
          workerName:  rels.map(r => r.worker?.name ?? '?').filter((v, i, a) => a.indexOf(v) === i).join(', '),
          deviceInfo:  `${latest.newDeviceName} (${fp}***)`,
          occurredAt:  latest.processedAt?.toISOString() ?? latest.requestedAt.toISOString(),
          severity:    'HIGH',
        })
      }
    }

    // A-2. 1시간 내 5건 이상 일괄 승인
    const adminReqMap = new Map<string, typeof requests>()
    for (const req of requests) {
      if (!req.processedBy) continue
      if (!adminReqMap.has(req.processedBy)) adminReqMap.set(req.processedBy, [])
      adminReqMap.get(req.processedBy)!.push(req)
    }
    for (const adminEntry of Array.from(adminReqMap.entries())) {
      const [, adminReqs] = adminEntry
      const sorted = [...adminReqs].sort(
        (a, b) => (a.processedAt?.getTime() ?? 0) - (b.processedAt?.getTime() ?? 0)
      )
      for (let i = 0; i < sorted.length; i++) {
        const wStart = sorted[i].processedAt?.getTime() ?? 0
        const inWindow = sorted.filter(r => {
          const t = r.processedAt?.getTime() ?? 0
          return t >= wStart && t <= wStart + 3_600_000
        })
          if (inWindow.length >= 5) {
          const last = inWindow[inWindow.length - 1]
          anomalies.push({
            type: 'bulk_approval',
            description: `${last.adminUser?.name ?? '?'} 관리자가 1시간 내 ${inWindow.length}건 연속 승인`,
            companyName: last.adminUser?.company?.companyName ?? '알 수 없음',
            adminName:   last.adminUser?.name ?? '알 수 없음',
            workerName:  inWindow.map(r => r.worker?.name ?? '?').filter((v, i, a) => a.indexOf(v) === i).slice(0, 5).join(', ')
              + (inWindow.length > 5 ? ` 외 ${inWindow.length - 5}명` : ''),
            deviceInfo:  `${inWindow.length}건 일괄 처리`,
            occurredAt:  last.processedAt?.toISOString() ?? last.requestedAt.toISOString(),
            severity:    inWindow.length >= 10 ? 'HIGH' : 'MEDIUM',
          })
          break
        }
      }
    }

    // A-3. 야간(22~06시 KST) 기기 승인
    for (const req of requests) {
      if (!req.processedAt) continue
      const kstHour = (req.processedAt.getUTCHours() + 9) % 24
      if (kstHour >= 22 || kstHour < 6) {
        anomalies.push({
          type: 'night_approval',
          description: `야간(KST ${kstHour}시)에 기기 변경 요청 승인됨`,
          companyName: req.adminUser?.company?.companyName ?? '알 수 없음',
          adminName:   req.adminUser?.name ?? '알 수 없음',
          workerName:  req.worker?.name ?? '알 수 없음',
          deviceInfo:  `${req.newDeviceName} (${req.newDeviceToken.slice(0, 8)}***)`,
          occurredAt:  req.processedAt.toISOString(),
          severity:    'LOW',
        })
      }
    }

    // ══════════════════════════════════════════════════
    //  B. 공수 수정 이상행위 (audit_logs 기반)
    // ══════════════════════════════════════════════════
    const workLogs = await prisma.auditLog.findMany({
      where: {
        actionType: 'UPDATE_WORKED_MINUTES',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    })

    // B-1. 동일 관리자 1시간 내 10건 이상 공수 수정
    const actorEditMap = new Map<string, typeof workLogs>()
    for (const log of workLogs) {
      if (!log.actorUserId) continue
      if (!actorEditMap.has(log.actorUserId)) actorEditMap.set(log.actorUserId, [])
      actorEditMap.get(log.actorUserId)!.push(log)
    }
    for (const actorEntry of Array.from(actorEditMap.entries())) {
      const [, logs] = actorEntry
      const sorted = [...logs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      for (let i = 0; i < sorted.length; i++) {
        const wStart = sorted[i].createdAt.getTime()
        const inWindow = sorted.filter(l => {
          const t = l.createdAt.getTime()
          return t >= wStart && t <= wStart + 3_600_000
        })
        if (inWindow.length >= 10) {
          const last = inWindow[inWindow.length - 1]
          anomalies.push({
            type: 'bulk_work_edit',
            description: `공수 수정 ${inWindow.length}건이 1시간 내 집중 발생`,
            companyName: last.companyId ?? '알 수 없음',
            adminName:   last.actorUserId ?? '알 수 없음',
            workerName:  `${inWindow.length}건`,
            deviceInfo:  '공수 수정',
            occurredAt:  last.createdAt.toISOString(),
            severity:    inWindow.length >= 20 ? 'HIGH' : 'MEDIUM',
          })
          break
        }
      }
    }

    // B-2. 야간(22~06시 KST) 공수 수정
    for (const log of workLogs) {
      const kstHour = (log.createdAt.getUTCHours() + 9) % 24
      if (kstHour >= 22 || kstHour < 6) {
        anomalies.push({
          type: 'night_work_edit',
          description: `야간(KST ${kstHour}시)에 공수 수동 수정 발생`,
          companyName: log.companyId ?? '알 수 없음',
          adminName:   log.actorUserId ?? '알 수 없음',
          workerName:  log.targetId ?? '알 수 없음',
          deviceInfo:  '공수 수정',
          occurredAt:  log.createdAt.toISOString(),
          severity:    'MEDIUM',
        })
      }
    }

    // B-3. 월말 3일 이내 집중 수정 (정산 직전 집중 수정)
    const now = new Date()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    if (dayOfMonth >= lastDayOfMonth - 2) {
      // 이번 달 1일부터 지금까지 수정 건수
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const preSettlementLogs = workLogs.filter(l => l.createdAt >= monthStart)
      // 월말 3일 이내에만 몰린 경우 탐지 (전체 수정의 70% 이상)
      const preDeadlineLogs = preSettlementLogs.filter(l => {
        const d = l.createdAt.getDate()
        return d >= lastDayOfMonth - 2
      })
      if (preDeadlineLogs.length >= 5 && preSettlementLogs.length > 0) {
        const ratio = preDeadlineLogs.length / preSettlementLogs.length
        if (ratio >= 0.7) {
          const last = preDeadlineLogs[preDeadlineLogs.length - 1]
          anomalies.push({
            type: 'pre_settlement_edit',
            description: `월마감 직전 3일 이내 공수 수정이 이달 전체의 ${Math.round(ratio * 100)}% 집중 (${preDeadlineLogs.length}건)`,
            companyName: last.companyId ?? '알 수 없음',
            adminName:   last.actorUserId ?? '알 수 없음',
            workerName:  `${preDeadlineLogs.length}건`,
            deviceInfo:  '공수 수정',
            occurredAt:  last.createdAt.toISOString(),
            severity:    'HIGH',
          })
        }
      }
    }

    // B-4. 동일 기록 3회 이상 반복 수정
    const targetEditCount = new Map<string, number>()
    for (const log of workLogs) {
      if (!log.targetId) continue
      targetEditCount.set(log.targetId, (targetEditCount.get(log.targetId) ?? 0) + 1)
    }
    for (const countEntry of Array.from(targetEditCount.entries())) {
      const [targetId, count] = countEntry
      if (count >= 3) {
        const related = workLogs.filter(l => l.targetId === targetId)
        const last = related[related.length - 1]
        anomalies.push({
          type: 'repeated_work_edit',
          description: `동일 출퇴근 기록이 ${count}회 반복 수정됨`,
          companyName: last.companyId ?? '알 수 없음',
          adminName:   last.actorUserId ?? '알 수 없음',
          workerName:  targetId,
          deviceInfo:  `${count}회 수정`,
          occurredAt:  last.createdAt.toISOString(),
          severity:    count >= 5 ? 'HIGH' : 'MEDIUM',
        })
      }
    }

    // 심각도 → 발생시각 순 정렬
    anomalies.sort((a, b) => {
      const sd = severityOrder[a.severity] - severityOrder[b.severity]
      if (sd !== 0) return sd
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    })

    return NextResponse.json({ success: true, data: anomalies })
  } catch (err) {
    console.error('[devices/anomalies GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
