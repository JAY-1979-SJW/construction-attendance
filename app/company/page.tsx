'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardData {
  totalWorkers: number
  todayCheckedIn: number
  todayCompleted: number
  pendingDevices: number
}

export default function CompanyDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/company/dashboard')
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { router.push('/company/login'); return }
        setData(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>대시보드</h1>
      {loading ? (
        <p style={styles.loading}>불러오는 중...</p>
      ) : data ? (
        <div style={styles.cards}>
          <StatCard label="소속 근로자 수" value={data.totalWorkers} unit="명" color="#0f4c75" />
          <StatCard label="오늘 출근" value={data.todayCheckedIn} unit="명" color="#2e7d32" />
          <StatCard label="오늘 퇴근 완료" value={data.todayCompleted} unit="명" color="#1565c0" />
          <StatCard label="기기 승인 대기" value={data.pendingDevices} unit="건" color="#e65100" />
        </div>
      ) : (
        <p style={styles.loading}>데이터를 불러올 수 없습니다.</p>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.cardAccent, background: color }} />
      <div style={styles.cardBody}>
        <div style={styles.cardLabel}>{label}</div>
        <div style={{ ...styles.cardValue, color }}>
          {value}
          <span style={styles.cardUnit}>{unit}</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '32px' },
  title: { fontSize: '22px', fontWeight: 700, margin: '0 0 24px', color: '#1a1a2e' },
  loading: { color: '#A0AEC0', fontSize: '15px' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
  card: { background: '#243144', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'row' },
  cardAccent: { width: '6px', flexShrink: 0 },
  cardBody: { padding: '20px 20px' },
  cardLabel: { fontSize: '13px', color: '#777', marginBottom: '8px', fontWeight: 500 },
  cardValue: { fontSize: '32px', fontWeight: 700 },
  cardUnit: { fontSize: '14px', fontWeight: 500, marginLeft: '4px' },
}
