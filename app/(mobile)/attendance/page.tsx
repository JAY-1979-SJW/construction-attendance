'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TodayStatus {
  id: string
  siteName: string
  siteAddress: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: 'WORKING' | 'COMPLETED' | 'EXCEPTION'
  checkInDistance: number | null
  checkOutDistance: number | null
}

interface WorkerInfo {
  name: string
  company: string
  jobTitle: string
}

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무 중',
  COMPLETED: '퇴근 완료',
  EXCEPTION: '예외 처리',
}

const STATUS_COLOR: Record<string, string> = {
  WORKING: '#2e7d32',
  COMPLETED: '#1565c0',
  EXCEPTION: '#e65100',
}

export default function AttendancePage() {
  const router = useRouter()
  const [worker, setWorker] = useState<WorkerInfo | null>(null)
  const [today, setToday] = useState<TodayStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/attendance/today').then((r) => r.json()),
    ]).then(([meData, todayData]) => {
      if (!meData.success) {
        router.push('/login')
        return
      }
      setWorker(meData.data)
      setToday(todayData.data)
      setLoading(false)
    })
  }, [router])

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>불러오는 중...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header}>
        <div>
          <div style={styles.workerName}>{worker?.name}</div>
          <div style={styles.workerInfo}>{worker?.company} · {worker?.jobTitle}</div>
        </div>
        <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))} style={styles.logoutBtn}>
          로그아웃
        </button>
      </div>

      {/* 오늘 현황 */}
      <div style={styles.card}>
        <div style={styles.dateLabel}>오늘의 출퇴근</div>
        {today ? (
          <>
            <div style={{ ...styles.statusBadge, background: STATUS_COLOR[today.status] }}>
              {STATUS_LABEL[today.status]}
            </div>
            <div style={styles.siteName}>{today.siteName}</div>
            <div style={styles.siteAddress}>{today.siteAddress}</div>
            <div style={styles.timeRow}>
              <div style={styles.timeBox}>
                <div style={styles.timeLabel}>출근</div>
                <div style={styles.timeValue}>{formatTime(today.checkInAt)}</div>
                {today.checkInDistance != null && (
                  <div style={styles.distanceLabel}>{today.checkInDistance}m</div>
                )}
              </div>
              <div style={styles.timeDivider}>→</div>
              <div style={styles.timeBox}>
                <div style={styles.timeLabel}>퇴근</div>
                <div style={styles.timeValue}>{formatTime(today.checkOutAt)}</div>
                {today.checkOutDistance != null && (
                  <div style={styles.distanceLabel}>{today.checkOutDistance}m</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={styles.noRecord}>
            <p>오늘 출근 기록이 없습니다.</p>
            <p style={{ fontSize: '13px', color: '#888' }}>현장 QR코드를 스캔하여 출근하세요.</p>
          </div>
        )}
      </div>

      {/* 안내 */}
      <div style={styles.guideCard}>
        <div style={styles.guideTitle}>출퇴근 방법</div>
        <div style={styles.guideStep}>1. 현장에 부착된 QR코드를 스캔하세요</div>
        <div style={styles.guideStep}>2. 위치 권한을 허용하세요</div>
        <div style={styles.guideStep}>3. 출근 / 퇴근 버튼을 누르세요</div>
      </div>

      {/* 기기 변경 요청 버튼 */}
      <button onClick={() => router.push('/device/change')} style={styles.changeDeviceBtn}>
        기기 변경 요청
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '20px', minHeight: '100vh' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingTop: '8px',
  },
  workerName: { fontSize: '18px', fontWeight: 700, color: '#1a1a2e' },
  workerInfo: { fontSize: '13px', color: '#666', marginTop: '2px' },
  logoutBtn: {
    background: 'none',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#666',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  dateLabel: { fontSize: '13px', color: '#888', marginBottom: '12px' },
  statusBadge: {
    display: 'inline-block',
    color: 'white',
    fontSize: '13px',
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: '20px',
    marginBottom: '12px',
  },
  siteName: { fontSize: '18px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' },
  siteAddress: { fontSize: '13px', color: '#888', marginBottom: '20px' },
  timeRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  timeBox: { flex: 1, textAlign: 'center' as const },
  timeLabel: { fontSize: '12px', color: '#999', marginBottom: '4px' },
  timeValue: { fontSize: '24px', fontWeight: 700, color: '#1a1a2e' },
  distanceLabel: { fontSize: '11px', color: '#aaa', marginTop: '4px' },
  timeDivider: { fontSize: '20px', color: '#ccc' },
  noRecord: { textAlign: 'center' as const, padding: '20px 0', color: '#555' },
  guideCard: {
    background: '#e3f2fd',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  },
  guideTitle: { fontSize: '14px', fontWeight: 700, color: '#1565c0', marginBottom: '12px' },
  guideStep: { fontSize: '13px', color: '#1976d2', marginBottom: '6px' },
  changeDeviceBtn: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    background: 'none',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    cursor: 'pointer',
    color: '#666',
  },
}
