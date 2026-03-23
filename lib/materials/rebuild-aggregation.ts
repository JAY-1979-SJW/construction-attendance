/**
 * Phase 3: 보정값 반영 재집계
 *
 * 기존 buildAggregation과 차이:
 * - excludeFromAggregation=true 행 제외
 * - manual_group_key 있으면 auto groupKey 대신 사용
 * - manualQuantity/manualUnit 있으면 raw값 대신 사용
 * - 결과에 manualOverrideUsed, aggregationStatus(DRAFT) 설정
 * - EstimateAggregationRun 이력 기록
 */

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'

export async function rebuildAggregation(
  documentId: string,
  triggeredBy: string
): Promise<{ aggregateCount: number; reviewRequiredCount: number }> {
  const run = await prisma.estimateAggregationRun.create({
    data: { documentId, runType: 'MANUAL_REBUILD' },
  })

  // 집계 후보 행 조회 (원문 + 정규화 + 보정 필드 포함)
  const candidateRows = await prisma.estimateBillRow.findMany({
    where: {
      documentId,
      rowType: 'DATA_ROW',
      aggregateCandidate: true,
      excludeFromAggregation: false,
    },
    include: { normalized: true },
  })

  // 유효 그룹키 결정: manualGroupKey > normalized.groupKey
  type CandidateRow = (typeof candidateRows)[number]

  function effectiveGroupKey(row: CandidateRow): string | null {
    if (row.manualGroupKey) return `manual:${row.manualGroupKey}`
    return row.normalized?.groupKey ?? null
  }

  // 그룹별 묶기
  const groups = new Map<string, CandidateRow[]>()
  for (const row of candidateRows) {
    const key = effectiveGroupKey(row)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  // 기존 집계 행 삭제
  await prisma.materialAggregateRow.deleteMany({ where: { documentId } })

  let aggregateCount = 0
  let reviewRequiredCount = 0

  // 그룹별 집계 행 생성
  for (const [groupKey, rows] of Array.from(groups.entries())) {
    const first = rows[0]
    const norm = first.normalized

    let totalQuantity = new Decimal(0)
    let totalAmount = new Decimal(0)
    let unitPriceInconsistent = false
    const unitPrices: Decimal[] = []
    let manualOverrideUsed = false

    for (const row of rows) {
      // 수량: manualQuantity 있으면 우선, 없으면 parsed quantity
      const qty = row.manualQuantity ?? row.quantity
      if (qty) totalQuantity = totalQuantity.plus(qty)
      if (row.amount) totalAmount = totalAmount.plus(row.amount)
      if (row.unitPrice) unitPrices.push(row.unitPrice)

      // 보정값 사용 여부 체크
      if (
        row.manualGroupKey ||
        row.manualItemName ||
        row.manualSpec ||
        row.manualUnit ||
        row.manualQuantity
      ) {
        manualOverrideUsed = true
      }
    }

    if (unitPrices.length > 1) {
      const firstPrice = unitPrices[0]
      unitPriceInconsistent = unitPrices.some(p => !p.equals(firstPrice))
    }

    const hasReview = rows.some(r => r.reviewRequired)
    const sourceRowIds = rows.map(r => r.id)

    // 대표 행의 표시값: manual > normalized > raw
    const displayItemName =
      first.manualItemName ?? norm?.normalizedItemName ?? first.rawItemName ?? '(미분류)'
    const displaySpec = first.manualSpec ?? norm?.normalizedSpec ?? null
    const displayUnit = first.manualUnit ?? norm?.normalizedUnit ?? null

    await prisma.materialAggregateRow.create({
      data: {
        documentId,
        discipline: first.discipline,
        itemCode: norm?.itemCode ?? null,
        normalizedItemName: displayItemName,
        normalizedSpec: displaySpec,
        normalizedUnit: displayUnit,
        itemCategory: norm?.itemCategory ?? null,
        totalQuantity,
        totalAmount: totalAmount.gt(0) ? totalAmount : null,
        sourceRowCount: rows.length,
        sourceRowIdsJson: JSON.stringify(sourceRowIds),
        unitPriceInconsistent,
        reviewRequired: hasReview,
        groupKey,
        aggregationStatus: 'DRAFT',
        manualOverrideUsed,
        regeneratedAt: new Date(),
      },
    })

    aggregateCount++
    if (hasReview) reviewRequiredCount++
  }

  // 집계 실행 이력 완료 업데이트
  await prisma.estimateAggregationRun.update({
    where: { id: run.id },
    data: {
      rowCount: candidateRows.length,
      aggregateCount,
      reviewRequiredCount,
      completedAt: new Date(),
    },
  })

  return { aggregateCount, reviewRequiredCount }
}
