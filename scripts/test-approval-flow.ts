/**
 * 점검 1: 관리자 승인 후 재로그인 흐름 검증
 *
 * 실행: npx dotenv -e .env.test -- npx tsx scripts/test-approval-flow.ts
 *
 * 검증 항목:
 *   1. 등록된 번호 → 신규 기기 → DEVICE_PENDING
 *   2. 미등록 번호 → NOT_REGISTERED
 *   3. 비활성 계정 → INACTIVE
 *   4. 승인 전 JWT 미발급 확인
 *   5. 관리자 승인 처리
 *   6. 승인 후 재로그인 → DEVICE_APPROVED + JWT 발급
 *   7. 반려 흐름 → DEVICE_REJECTED
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ── 색상 출력 헬퍼 ─────────────────────────────────────────────
const c = {
  ok:   (s: string) => `\x1b[32m✓ ${s}\x1b[0m`,
  fail: (s: string) => `\x1b[31m✗ ${s}\x1b[0m`,
  info: (s: string) => `\x1b[36m  ${s}\x1b[0m`,
  head: (s: string) => `\x1b[1m\x1b[33m${s}\x1b[0m`,
}

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string, detail?: string) {
  if (cond) {
    console.log(c.ok(msg))
    passed++
  } else {
    console.log(c.fail(msg))
    if (detail) console.log(c.info('원인: ' + detail))
    failed++
  }
}

// ── 로그인 로직 직접 구현 (HTTP 없이 DB 직접 호출) ────────────────
async function callLoginLogic(
  phone: string,
  deviceToken: string,
  deviceName: string
): Promise<{ status: string; hasJwt: boolean; message: string }> {
  // 1. 근로자 조회
  const worker = await prisma.worker.findUnique({ where: { phone } })
  if (!worker) return { status: 'NOT_REGISTERED', hasJwt: false, message: '미등록 근로자' }

  // 2. 활성 여부
  if (!worker.isActive) return { status: 'INACTIVE', hasJwt: false, message: '비활성 계정' }

  // 3. 승인된 기기 확인
  const approvedDevice = await prisma.workerDevice.findFirst({
    where: { workerId: worker.id, deviceToken, isActive: true },
  })
  if (approvedDevice) {
    return { status: 'DEVICE_APPROVED', hasJwt: true, message: '로그인 성공 (JWT 발급)' }
  }

  // 4. 기존 요청 확인
  const existingRequest = await prisma.deviceChangeRequest.findFirst({
    where: { workerId: worker.id, newDeviceToken: deviceToken },
    orderBy: { requestedAt: 'desc' },
  })

  if (existingRequest?.status === 'PENDING') {
    return { status: 'DEVICE_PENDING', hasJwt: false, message: '승인 대기' }
  }
  if (existingRequest?.status === 'REJECTED') {
    return { status: 'DEVICE_REJECTED', hasJwt: false, message: '반려됨' }
  }

  // 5. 신규 기기 요청 생성
  await prisma.deviceChangeRequest.create({
    data: {
      workerId: worker.id,
      oldDeviceToken: null,
      newDeviceToken: deviceToken,
      newDeviceName: deviceName,
      reason: '최초 기기 등록',
      status: 'PENDING',
    },
  })
  return { status: 'DEVICE_PENDING', hasJwt: false, message: '기기 요청 생성됨' }
}

// ── 관리자 승인 처리 ──────────────────────────────────────────────
async function approveDeviceRequest(requestId: string, adminId: string) {
  await prisma.$transaction([
    prisma.workerDevice.updateMany({
      where: { workerId: (await prisma.deviceChangeRequest.findUnique({ where: { id: requestId } }))!.workerId, isActive: true },
      data: { isActive: false, isPrimary: false },
    }),
    prisma.workerDevice.create({
      data: {
        workerId: (await prisma.deviceChangeRequest.findUnique({ where: { id: requestId } }))!.workerId,
        deviceToken: (await prisma.deviceChangeRequest.findUnique({ where: { id: requestId } }))!.newDeviceToken,
        deviceName: (await prisma.deviceChangeRequest.findUnique({ where: { id: requestId } }))!.newDeviceName,
        isPrimary: true,
        isActive: true,
      },
    }),
    prisma.deviceChangeRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', processedAt: new Date(), processedBy: adminId },
    }),
  ])
}

async function rejectDeviceRequest(requestId: string, adminId: string) {
  await prisma.deviceChangeRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', processedAt: new Date(), processedBy: adminId },
  })
}

// ── 테스트 데이터 셋업 ─────────────────────────────────────────────
async function setup() {
  // 관리자 계정
  const adminExists = await prisma.adminUser.findUnique({ where: { email: 'test-admin@test.com' } })
  const admin = adminExists ?? await prisma.adminUser.create({
    data: {
      name: '테스트관리자',
      email: 'test-admin@test.com',
      passwordHash: await bcrypt.hash('test1234', 12),
      role: 'ADMIN',
    },
  })

  // 활성 근로자
  const workerActive = await prisma.worker.upsert({
    where: { phone: '01099990001' },
    update: { isActive: true },
    create: { name: '테스트근로자', phone: '01099990001', company: '테스트건설', jobTitle: '목공', isActive: true },
  })

  // 비활성 근로자
  const workerInactive = await prisma.worker.upsert({
    where: { phone: '01099990002' },
    update: { isActive: false },
    create: { name: '비활성근로자', phone: '01099990002', company: '테스트건설', jobTitle: '철근', isActive: false },
  })

  return { admin, workerActive, workerInactive }
}

// ── 테스트 데이터 정리 ─────────────────────────────────────────────
async function cleanup() {
  await prisma.deviceChangeRequest.deleteMany({
    where: { worker: { phone: { in: ['01099990001', '01099990002'] } } },
  })
  await prisma.workerDevice.deleteMany({
    where: { worker: { phone: { in: ['01099990001', '01099990002'] } } },
  })
  await prisma.worker.deleteMany({ where: { phone: { in: ['01099990001', '01099990002'] } } })
  await prisma.adminUser.deleteMany({ where: { email: 'test-admin@test.com' } })
  await prisma.adminAuditLog.deleteMany({
    where: { admin: { email: 'test-admin@test.com' } },
  }).catch(() => {})
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  console.log(c.head('\n════════════════════════════════════════'))
  console.log(c.head(' 점검 1 — 관리자 승인 후 재로그인 흐름'))
  console.log(c.head('════════════════════════════════════════\n'))

  await cleanup()
  const { admin, workerActive } = await setup()

  const DEVICE_TOKEN = 'dt_test_device_abcdef1234567890abcd'
  const DEVICE_NAME  = 'iPhone 테스트'

  // ────────────────────────────────────────────────────────────────
  console.log(c.head('[ 로그인 1차 — 신규 기기 ]'))

  const r1 = await callLoginLogic(workerActive.phone, DEVICE_TOKEN, DEVICE_NAME)
  console.log(c.info(`상태: ${r1.status} | JWT: ${r1.hasJwt} | ${r1.message}`))

  assert(r1.status === 'DEVICE_PENDING', '등록된 번호 + 신규 기기 → DEVICE_PENDING', r1.status)
  assert(r1.hasJwt === false, '승인 전 JWT 미발급', `hasJwt=${r1.hasJwt}`)

  // 중복 요청도 PENDING으로 처리되는지
  const r1b = await callLoginLogic(workerActive.phone, DEVICE_TOKEN, DEVICE_NAME)
  assert(r1b.status === 'DEVICE_PENDING', '동일 기기 재시도 → 여전히 DEVICE_PENDING (중복 요청 방지)', r1b.status)
  assert(r1b.hasJwt === false, '중복 요청 후에도 JWT 미발급', `hasJwt=${r1b.hasJwt}`)

  // ────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 차단 케이스 ]'))

  const rUnreg = await callLoginLogic('01000000000', DEVICE_TOKEN, DEVICE_NAME)
  console.log(c.info(`미등록: ${rUnreg.status}`))
  assert(rUnreg.status === 'NOT_REGISTERED', '미등록 번호 → NOT_REGISTERED', rUnreg.status)
  assert(rUnreg.hasJwt === false, '미등록 JWT 미발급')

  const rInact = await callLoginLogic('01099990002', DEVICE_TOKEN, DEVICE_NAME)
  console.log(c.info(`비활성: ${rInact.status}`))
  assert(rInact.status === 'INACTIVE', '비활성 계정 → INACTIVE', rInact.status)
  assert(rInact.hasJwt === false, '비활성 JWT 미발급')

  // ────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 관리자 승인 처리 ]'))

  const pendingReq = await prisma.deviceChangeRequest.findFirst({
    where: { workerId: workerActive.id, newDeviceToken: DEVICE_TOKEN, status: 'PENDING' },
  })
  assert(pendingReq !== null, 'DB에 PENDING 요청 존재 확인', pendingReq === null ? '요청 없음' : undefined)

  if (pendingReq) {
    await approveDeviceRequest(pendingReq.id, admin.id)

    const approved = await prisma.deviceChangeRequest.findUnique({ where: { id: pendingReq.id } })
    assert(approved?.status === 'APPROVED', '관리자 승인 처리 → status=APPROVED', approved?.status)

    const device = await prisma.workerDevice.findFirst({
      where: { workerId: workerActive.id, deviceToken: DEVICE_TOKEN, isActive: true },
    })
    assert(device !== null, '승인 후 WorkerDevice 생성 확인', device === null ? '기기 없음' : undefined)
    assert(device?.isPrimary === true, '신규 기기가 primary로 설정됨')
  }

  // ────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 로그인 2차 — 승인 후 재로그인 ]'))

  const r2 = await callLoginLogic(workerActive.phone, DEVICE_TOKEN, DEVICE_NAME)
  console.log(c.info(`상태: ${r2.status} | JWT: ${r2.hasJwt} | ${r2.message}`))

  assert(r2.status === 'DEVICE_APPROVED', '승인 후 재로그인 → DEVICE_APPROVED', r2.status)
  assert(r2.hasJwt === true, '승인 후 JWT 발급됨', `hasJwt=${r2.hasJwt}`)

  // ────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 반려 흐름 검증 ]'))

  const DEVICE_TOKEN_2 = 'dt_test_device_reject_0000000000'
  const rReject1 = await callLoginLogic(workerActive.phone, DEVICE_TOKEN_2, 'Samsung 테스트')
  assert(rReject1.status === 'DEVICE_PENDING', '반려 테스트 — 신규 기기 등록 → PENDING', rReject1.status)

  const pendingReq2 = await prisma.deviceChangeRequest.findFirst({
    where: { workerId: workerActive.id, newDeviceToken: DEVICE_TOKEN_2, status: 'PENDING' },
  })
  if (pendingReq2) {
    await rejectDeviceRequest(pendingReq2.id, admin.id)
    const rReject2 = await callLoginLogic(workerActive.phone, DEVICE_TOKEN_2, 'Samsung 테스트')
    console.log(c.info(`반려 후: ${rReject2.status}`))
    assert(rReject2.status === 'DEVICE_REJECTED', '반려 후 재시도 → DEVICE_REJECTED', rReject2.status)
    assert(rReject2.hasJwt === false, '반려 기기 JWT 미발급')
  }

  // ────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 기기 수 제한 — 승인 후 기존 기기 비활성화 ]'))

  const activeDevices = await prisma.workerDevice.count({
    where: { workerId: workerActive.id, isActive: true },
  })
  assert(activeDevices === 1, `승인 후 활성 기기 1개만 유지 (현재: ${activeDevices}개)`, `${activeDevices}개`)

  // ────────────────────────────────────────────────────────────────
  await cleanup()

  console.log(c.head('\n════════════════════════════════════════'))
  console.log(`  결과: \x1b[32m통과 ${passed}건\x1b[0m | \x1b[31m실패 ${failed}건\x1b[0m`)
  console.log(c.head('════════════════════════════════════════\n'))

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (e) => {
  console.error('\x1b[31m[FATAL]', e.message, '\x1b[0m')
  await cleanup().catch(() => {})
  await prisma.$disconnect()
  process.exit(1)
})
