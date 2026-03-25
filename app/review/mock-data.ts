// ─── 검토용 목업 데이터 (운영 데이터 아님) ───────────────────────────────────
// 개인정보 마스킹 처리된 가상 데이터

export const MOCK_SUMMARY = {
  totalWorkers: 47,
  activeSites: 5,
  todayTotal: 31,
  todayCheckedIn: 18,
  todayCompleted: 10,
  pendingMissing: 3,
  pendingExceptions: 2,
  pendingDeviceRequests: 4,
  todayPresenceTotal: 12,
  todayPresencePending: 0,
  todayPresenceReview: 1,
  todayPresenceNoResponse: 0,
}

export const MOCK_ATTENDANCE: {
  id: string; workerName: string; company: string; siteName: string
  checkInAt: string | null; checkOutAt: string | null; status: string
}[] = [
  { id: '1', workerName: '홍**', company: '(주)한국건설',    siteName: '강남 현장', checkInAt: '2026-03-25T08:12:00+09:00', checkOutAt: null,                         status: 'MISSING_CHECKOUT' },
  { id: '2', workerName: '김**', company: '(주)서울건설',    siteName: '서초 현장', checkInAt: '2026-03-25T08:45:00+09:00', checkOutAt: null,                         status: 'EXCEPTION' },
  { id: '3', workerName: '이**', company: '(주)한국건설',    siteName: '강남 현장', checkInAt: '2026-03-25T07:55:00+09:00', checkOutAt: null,                         status: 'WORKING' },
  { id: '4', workerName: '박**', company: '(주)동부건설',    siteName: '송파 현장', checkInAt: '2026-03-25T08:02:00+09:00', checkOutAt: null,                         status: 'WORKING' },
  { id: '5', workerName: '정**', company: '(주)서울건설',    siteName: '서초 현장', checkInAt: '2026-03-25T09:10:00+09:00', checkOutAt: null,                         status: 'WORKING' },
  { id: '6', workerName: '최**', company: '(주)한국건설',    siteName: '강동 현장', checkInAt: '2026-03-25T08:30:00+09:00', checkOutAt: null,                         status: 'WORKING' },
  { id: '7', workerName: '강**', company: '(주)미래건설',    siteName: '마포 현장', checkInAt: '2026-03-25T08:20:00+09:00', checkOutAt: null,                         status: 'WORKING' },
  { id: '8', workerName: '윤**', company: '(주)동부건설',    siteName: '송파 현장', checkInAt: '2026-03-25T07:48:00+09:00', checkOutAt: '2026-03-25T17:12:00+09:00', status: 'COMPLETED' },
  { id: '9', workerName: '장**', company: '(주)미래건설',    siteName: '마포 현장', checkInAt: '2026-03-25T08:05:00+09:00', checkOutAt: '2026-03-25T17:30:00+09:00', status: 'COMPLETED' },
  { id: '10', workerName: '조**', company: '(주)한국건설',   siteName: '강남 현장', checkInAt: '2026-03-25T08:15:00+09:00', checkOutAt: '2026-03-25T18:00:00+09:00', status: 'COMPLETED' },
]

export const MOCK_WORKERS: {
  id: string; name: string; phone: string; jobTitle: string
  isActive: boolean; employmentType: string; company: string; site: string; createdAt: string
}[] = [
  { id: 'w1',  name: '홍**', phone: '010-****-1234', jobTitle: '형틀목공',   isActive: true,  employmentType: '건설일용', company: '(주)한국건설',  site: '강남 현장', createdAt: '2026-01-10' },
  { id: 'w2',  name: '김**', phone: '010-****-5678', jobTitle: '철근공',     isActive: true,  employmentType: '건설일용', company: '(주)서울건설',  site: '서초 현장', createdAt: '2026-01-15' },
  { id: 'w3',  name: '이**', phone: '010-****-2345', jobTitle: '배관공',     isActive: true,  employmentType: '건설일용', company: '(주)한국건설',  site: '강남 현장', createdAt: '2026-01-20' },
  { id: 'w4',  name: '박**', phone: '010-****-3456', jobTitle: '전기공',     isActive: true,  employmentType: '건설일용', company: '(주)동부건설',  site: '송파 현장', createdAt: '2026-02-01' },
  { id: 'w5',  name: '정**', phone: '010-****-4567', jobTitle: '미장공',     isActive: true,  employmentType: '건설일용', company: '(주)서울건설',  site: '서초 현장', createdAt: '2026-02-05' },
  { id: 'w6',  name: '최**', phone: '010-****-6789', jobTitle: '도장공',     isActive: true,  employmentType: '건설일용', company: '(주)한국건설',  site: '강동 현장', createdAt: '2026-02-10' },
  { id: 'w7',  name: '강**', phone: '010-****-7890', jobTitle: '조적공',     isActive: false, employmentType: '건설일용', company: '(주)미래건설',  site: '마포 현장', createdAt: '2026-02-12' },
  { id: 'w8',  name: '윤**', phone: '010-****-8901', jobTitle: '형틀목공',   isActive: true,  employmentType: '건설일용', company: '(주)동부건설',  site: '송파 현장', createdAt: '2026-02-15' },
  { id: 'w9',  name: '장**', phone: '010-****-9012', jobTitle: '철근공',     isActive: true,  employmentType: '건설일용', company: '(주)미래건설',  site: '마포 현장', createdAt: '2026-02-18' },
  { id: 'w10', name: '조**', phone: '010-****-0123', jobTitle: '특수용접',   isActive: true,  employmentType: '건설일용', company: '(주)한국건설',  site: '강남 현장', createdAt: '2026-03-01' },
]

export const MOCK_SITES: {
  id: string; name: string; address: string; isActive: boolean
  workerCount: number; todayCount: number; allowedRadius: number; openedAt: string
}[] = [
  { id: 's1', name: '강남 현장',  address: '서울 강남구 테헤란로 123',    isActive: true,  workerCount: 12, todayCount: 8,  allowedRadius: 100, openedAt: '2025-11-01' },
  { id: 's2', name: '서초 현장',  address: '서울 서초구 서초대로 456',    isActive: true,  workerCount: 9,  todayCount: 6,  allowedRadius: 80,  openedAt: '2025-12-01' },
  { id: 's3', name: '송파 현장',  address: '서울 송파구 올림픽로 789',    isActive: true,  workerCount: 8,  todayCount: 7,  allowedRadius: 100, openedAt: '2026-01-10' },
  { id: 's4', name: '강동 현장',  address: '서울 강동구 천호대로 321',    isActive: true,  workerCount: 10, todayCount: 5,  allowedRadius: 120, openedAt: '2026-01-15' },
  { id: 's5', name: '마포 현장',  address: '서울 마포구 월드컵북로 654',  isActive: false, workerCount: 8,  todayCount: 5,  allowedRadius: 90,  openedAt: '2026-02-01' },
]

export const MOCK_APPROVALS: {
  id: string; workerName: string; phone: string; type: string
  deviceModel: string; requestedAt: string; status: string; siteName: string
}[] = [
  { id: 'a1', workerName: '홍**', phone: '010-****-1234', type: '기기 변경',   deviceModel: 'iPhone 15 Pro', requestedAt: '2026-03-25T09:00:00+09:00', status: 'PENDING', siteName: '강남 현장' },
  { id: 'a2', workerName: '김**', phone: '010-****-5678', type: '기기 변경',   deviceModel: '갤럭시 S24',    requestedAt: '2026-03-25T09:30:00+09:00', status: 'PENDING', siteName: '서초 현장' },
  { id: 'a3', workerName: '이**', phone: '010-****-2345', type: '신규 등록',   deviceModel: 'iPhone 14',     requestedAt: '2026-03-24T14:20:00+09:00', status: 'PENDING', siteName: '강남 현장' },
  { id: 'a4', workerName: '박**', phone: '010-****-3456', type: '기기 변경',   deviceModel: '갤럭시 A55',    requestedAt: '2026-03-24T15:00:00+09:00', status: 'PENDING', siteName: '송파 현장' },
  { id: 'a5', workerName: '정**', phone: '010-****-4567', type: '예외 승인',   deviceModel: '-',             requestedAt: '2026-03-25T10:00:00+09:00', status: 'PENDING', siteName: '서초 현장' },
  { id: 'a6', workerName: '최**', phone: '010-****-6789', type: '예외 승인',   deviceModel: '-',             requestedAt: '2026-03-24T16:30:00+09:00', status: 'PENDING', siteName: '강동 현장' },
]
