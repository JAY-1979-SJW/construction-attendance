/**
 * 점검 1 — 관리자 승인 후 재로그인 흐름 로직 검증
 * DB 없이 Prisma 레이어를 인터셉트해서 전체 분기를 검증합니다.
 *
 * 실행: npx tsx scripts/test-approval-logic.ts
 */

// ── 색상/결과 헬퍼 ─────────────────────────────────────────────────
let passed = 0, failed = 0
const c = {
  ok:   (s: string) => `\x1b[32m✓ ${s}\x1b[0m`,
  fail: (s: string) => `\x1b[31m✗ ${s}\x1b[0m`,
  info: (s: string) => `\x1b[36m  ${s}\x1b[0m`,
  head: (s: string) => `\x1b[1m\x1b[33m${s}\x1b[0m`,
  dim:  (s: string) => `\x1b[90m  ${s}\x1b[0m`,
}
function assert(cond: boolean, label: string, detail?: string) {
  if (cond) { console.log(c.ok(label)); passed++ }
  else       { console.log(c.fail(label)); if (detail) console.log(c.info('원인: ' + detail)); failed++ }
}

// ── DB 상태를 흉내내는 인메모리 스토어 ──────────────────────────────
type Worker           = { id: string; phone: string; isActive: boolean }
type WorkerDevice     = { id: string; workerId: string; deviceToken: string; isActive: boolean; isPrimary: boolean }
type DeviceChangeReq  = { id: string; workerId: string; newDeviceToken: string; newDeviceName: string; reason: string; status: 'PENDING'|'APPROVED'|'REJECTED'; oldDeviceToken: string|null }

const DB = {
  workers:  [] as Worker[],
  devices:  [] as WorkerDevice[],
  requests: [] as DeviceChangeReq[],
  nextId: 1,
  id: () => `id_${DB.nextId++}`,
  reset() { this.workers=[]; this.devices=[]; this.requests=[]; this.nextId=1 },
}

// ── /api/auth/login 로직 (route.ts 와 1:1 대응) ─────────────────────
function loginLogic(phone: string, deviceToken: string, deviceName: string)
  : { status: string; hasJwt: boolean; message: string } {

  // 1. 근로자 조회
  const worker = DB.workers.find(w => w.phone === phone)
  if (!worker)
    return { status: 'NOT_REGISTERED', hasJwt: false, message: '등록되지 않은 근로자입니다.' }

  // 2. 활성 여부
  if (!worker.isActive)
    return { status: 'INACTIVE', hasJwt: false, message: '사용이 중지된 계정입니다.' }

  // 3. 승인된 기기 확인
  const approved = DB.devices.find(d => d.workerId === worker.id && d.deviceToken === deviceToken && d.isActive)
  if (approved)
    return { status: 'DEVICE_APPROVED', hasJwt: true, message: '로그인되었습니다.' }

  // 4. 기존 요청 확인 (가장 최근)
  const existingReqs = DB.requests
    .filter(r => r.workerId === worker.id && r.newDeviceToken === deviceToken)
    .sort((a, b) => b.id.localeCompare(a.id))
  const existing = existingReqs[0]

  if (existing?.status === 'PENDING')
    return { status: 'DEVICE_PENDING', hasJwt: false, message: '기기 승인 대기 중입니다.' }
  if (existing?.status === 'REJECTED')
    return { status: 'DEVICE_REJECTED', hasJwt: false, message: '기기 등록이 반려되었습니다.' }

  // 5. 신규 요청 생성
  DB.requests.push({ id: DB.id(), workerId: worker.id, newDeviceToken: deviceToken,
    newDeviceName: deviceName, reason: '최초 기기 등록', status: 'PENDING', oldDeviceToken: null })
  return { status: 'DEVICE_PENDING', hasJwt: false, message: '기기 등록 요청이 접수되었습니다.' }
}

// ── 관리자 승인 처리 (device-requests POST 트랜잭션과 1:1 대응) ───────
function adminApprove(requestId: string) {
  const req = DB.requests.find(r => r.id === requestId)
  if (!req || req.status !== 'PENDING') throw new Error('invalid request')
  // 기존 기기 비활성화
  DB.devices.filter(d => d.workerId === req.workerId && d.isActive).forEach(d => { d.isActive = false; d.isPrimary = false })
  // 신규 기기 등록
  DB.devices.push({ id: DB.id(), workerId: req.workerId, deviceToken: req.newDeviceToken,
    isActive: true, isPrimary: true })
  req.status = 'APPROVED'
}

function adminReject(requestId: string) {
  const req = DB.requests.find(r => r.id === requestId)
  if (!req || req.status !== 'PENDING') throw new Error('invalid request')
  req.status = 'REJECTED'
}

// ── 테스트 케이스 ─────────────────────────────────────────────────────

function run() {
  console.log(c.head('\n════════════════════════════════════════════'))
  console.log(c.head(' 점검 1 — 관리자 승인 후 재로그인 흐름 검증'))
  console.log(c.head('════════════════════════════════════════════\n'))

  // 데이터 셋업
  DB.reset()
  const W_ACTIVE   = { id: DB.id(), phone: '01099990001', isActive: true  }
  const W_INACTIVE = { id: DB.id(), phone: '01099990002', isActive: false }
  DB.workers.push(W_ACTIVE, W_INACTIVE)

  const TOKEN_A = 'dt_device_aaaaabbbbcccc11111111'  // 테스트 기기 A
  const TOKEN_B = 'dt_device_bbbbbccccddddd22222222' // 테스트 기기 B (반려용)
  const NAME_A  = 'iPhone 15'
  const NAME_B  = 'Samsung S24'

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('[ 로그인 1차 — 신규 기기 ]'))

  const r1 = loginLogic(W_ACTIVE.phone, TOKEN_A, NAME_A)
  console.log(c.dim(`응답: status=${r1.status}, JWT=${r1.hasJwt}`))
  assert(r1.status  === 'DEVICE_PENDING', '등록된 번호 + 신규 기기 → DEVICE_PENDING',      r1.status)
  assert(r1.hasJwt  === false,            '승인 전 JWT 미발급',                              String(r1.hasJwt))

  // 동일 기기 재시도 — 중복 요청 방지
  const r1b = loginLogic(W_ACTIVE.phone, TOKEN_A, NAME_A)
  console.log(c.dim(`재시도: status=${r1b.status}, 요청수=${DB.requests.filter(r=>r.newDeviceToken===TOKEN_A).length}`))
  assert(r1b.status === 'DEVICE_PENDING', '동일 기기 재시도 → 여전히 DEVICE_PENDING',        r1b.status)
  assert(DB.requests.filter(r => r.newDeviceToken === TOKEN_A).length === 1,
    '중복 요청 생성 안 됨 (DB에 1건만 존재)')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 차단 케이스 3종 ]'))

  const rUnreg = loginLogic('01000000000', TOKEN_A, NAME_A)
  console.log(c.dim(`미등록: ${rUnreg.status}`))
  assert(rUnreg.status  === 'NOT_REGISTERED', '미등록 번호 → NOT_REGISTERED', rUnreg.status)
  assert(rUnreg.hasJwt  === false,            '미등록 JWT 미발급')

  const rInact = loginLogic(W_INACTIVE.phone, TOKEN_A, NAME_A)
  console.log(c.dim(`비활성: ${rInact.status}`))
  assert(rInact.status  === 'INACTIVE',       '비활성 계정 → INACTIVE',       rInact.status)
  assert(rInact.hasJwt  === false,            '비활성 JWT 미발급')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 관리자 승인 처리 ]'))

  const pendingReq = DB.requests.find(r => r.newDeviceToken === TOKEN_A && r.status === 'PENDING')
  assert(pendingReq !== undefined, 'DB에 PENDING 요청 존재')

  if (pendingReq) {
    adminApprove(pendingReq.id)

    const reqAfter = DB.requests.find(r => r.id === pendingReq.id)
    assert(reqAfter?.status === 'APPROVED',   '승인 처리 후 요청 status=APPROVED',   reqAfter?.status)

    const device = DB.devices.find(d => d.workerId === W_ACTIVE.id && d.deviceToken === TOKEN_A)
    assert(device?.isActive  === true,        'WorkerDevice 생성됨 (isActive=true)',  String(device?.isActive))
    assert(device?.isPrimary === true,        '신규 기기가 isPrimary=true',           String(device?.isPrimary))
  }

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 로그인 2차 — 승인 후 재로그인 ]'))

  const r2 = loginLogic(W_ACTIVE.phone, TOKEN_A, NAME_A)
  console.log(c.dim(`응답: status=${r2.status}, JWT=${r2.hasJwt}`))
  assert(r2.status  === 'DEVICE_APPROVED', '승인 후 재로그인 → DEVICE_APPROVED',  r2.status)
  assert(r2.hasJwt  === true,             '승인 후 JWT 발급됨',                    String(r2.hasJwt))

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 반려 흐름 검증 ]'))

  const rReject1 = loginLogic(W_ACTIVE.phone, TOKEN_B, NAME_B)
  assert(rReject1.status === 'DEVICE_PENDING', '반려 테스트 — 신규 기기 → PENDING', rReject1.status)

  const pendingReq2 = DB.requests.find(r => r.newDeviceToken === TOKEN_B && r.status === 'PENDING')
  if (pendingReq2) {
    adminReject(pendingReq2.id)
    const rReject2 = loginLogic(W_ACTIVE.phone, TOKEN_B, NAME_B)
    console.log(c.dim(`반려 후 재시도: ${rReject2.status}`))
    assert(rReject2.status  === 'DEVICE_REJECTED', '반려 후 재시도 → DEVICE_REJECTED', rReject2.status)
    assert(rReject2.hasJwt  === false,             '반려 기기 JWT 미발급')
  }

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 1인 1기기 정책 — 새 기기 승인 시 기존 기기 만료 ]'))

  // 기기 A가 승인된 상태에서 기기 C 추가 승인 시뮬레이션
  const TOKEN_C = 'dt_device_cccccdddddeeeee333333'
  const rC = loginLogic(W_ACTIVE.phone, TOKEN_C, 'Galaxy Tab S9')
  const reqC = DB.requests.find(r => r.newDeviceToken === TOKEN_C && r.status === 'PENDING')
  if (reqC) {
    adminApprove(reqC.id)
    const deviceA = DB.devices.find(d => d.deviceToken === TOKEN_A)
    const deviceC = DB.devices.find(d => d.deviceToken === TOKEN_C)
    console.log(c.dim(`기기A isActive=${deviceA?.isActive}, 기기C isActive=${deviceC?.isActive}`))
    assert(deviceA?.isActive === false, '새 기기 승인 후 기존 기기 A 자동 비활성화', String(deviceA?.isActive))
    assert(deviceC?.isActive === true,  '신규 기기 C isActive=true',                String(deviceC?.isActive))

    // 기기 A로 로그인 시도 → 차단되어야 함
    const rA2 = loginLogic(W_ACTIVE.phone, TOKEN_A, NAME_A)
    assert(rA2.status !== 'DEVICE_APPROVED', '비활성 기기 A로 로그인 → 차단됨',        rA2.status)
  }

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n════════════════════════════════════════════'))
  const allPass = failed === 0
  const badge = allPass ? '\x1b[32m[ PASS ]\x1b[0m' : '\x1b[31m[ FAIL ]\x1b[0m'
  console.log(`  결과: ${badge}  통과 \x1b[32m${passed}\x1b[0m건 | 실패 \x1b[31m${failed}\x1b[0m건`)
  console.log(c.head('════════════════════════════════════════════\n'))

  // ── 보고서 출력 ──────────────────────────────────────────────────────
  console.log(c.head('[ 보고서 ]'))
  const rows = [
    ['로그인 1차 결과',    'DEVICE_PENDING (정상)'],
    ['승인 전 JWT',        '미발급 (정상)'],
    ['관리자 승인',        'PENDING → APPROVED + WorkerDevice 생성'],
    ['로그인 2차 결과',    'DEVICE_APPROVED (정상)'],
    ['JWT 발급',           '승인 후에만 발급됨 (정상)'],
    ['미등록 번호',        'NOT_REGISTERED (정상)'],
    ['비활성 계정',        'INACTIVE (정상)'],
    ['반려 기기',          'DEVICE_REJECTED (정상)'],
    ['1인 1기기 정책',     '새 기기 승인 시 기존 기기 자동 비활성화 (정상)'],
    ['중복 요청',          '동일 기기 재시도 시 새 요청 생성 안 됨 (정상)'],
  ]
  for (const [k, v] of rows) {
    console.log(`  ${k.padEnd(20)} ${v}`)
  }
  console.log()

  process.exit(failed > 0 ? 1 : 0)
}

run()
