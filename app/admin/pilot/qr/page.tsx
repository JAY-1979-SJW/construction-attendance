'use client'

/**
 * /admin/pilot/qr
 *
 * 파일럿 현장 QR 인쇄물 생성 페이지.
 * 활성 현장 전체를 조회해 A4 인쇄용 카드로 출력.
 *
 * 사용법:
 * 1. 브라우저에서 이 페이지 열기
 * 2. 하단 "인쇄" 버튼 클릭 → 브라우저 인쇄 대화상자
 * 3. A4, 여백 최소, 배경 그래픽 포함으로 설정
 *
 * QR 동작:
 * - 스캔 시 /qr/<qrToken> 으로 이동
 * - 앱이 현재 상태에 따라 자동 분기 (출근 / 이동 / 퇴근)
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Site {
  id: string
  name: string
  address: string
  qrToken: string
}

export default function PilotQrPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [baseUrl] = useState('https://attendance.haehan-ai.kr')

  const load = useCallback(() => {
    fetch('/api/admin/sites')
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { router.push('/admin/login'); return }
        setSites(res.data.items ?? res.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={centerStyle}>로딩 중...</div>

  return (
    <>
      {/* 화면용 컨트롤 — 인쇄 시 숨김 */}
      <div className="no-print" style={controlBar}>
        <Link href="/admin/pilot" style={backLink}>← 파일럿 모니터링</Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '13px', color: '#666', marginRight: '16px' }}>
          현장 {sites.length}개 | A4 인쇄 권장 (배경 그래픽 포함)
        </span>
        <button onClick={() => window.print()} style={printBtn}>
          🖨️ 인쇄
        </button>
      </div>

      {/* 인쇄 대상 영역 */}
      <div style={printArea}>
        {sites.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
            등록된 활성 현장이 없습니다.
          </div>
        ) : (
          sites.map((site) => (
            <QrCard
              key={site.id}
              site={site}
              siteId={site.id}
              baseUrl={baseUrl}
            />
          ))
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .qr-card {
            page-break-after: always;
            page-break-inside: avoid;
          }
          .qr-card:last-child { page-break-after: auto; }
        }
      `}</style>
    </>
  )
}

function QrCard({ site, siteId, baseUrl }: { site: Site; siteId: string; baseUrl: string }) {
  const qrUrl = `/api/admin/sites/qr?siteId=${siteId}`
  const targetUrl = `${baseUrl}/qr/${site.qrToken}`

  return (
    <div className="qr-card" style={card}>
      {/* 헤더 */}
      <div style={cardHeader}>
        <div style={cardTitle}>해한건설 출퇴근 QR</div>
        <div style={cardDate}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* 현장명 */}
      <div style={siteName}>{site.name}</div>
      <div style={siteAddress}>{site.address}</div>

      {/* QR 이미지 */}
      <div style={qrWrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt={`${site.name} QR`}
          style={qrImage}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>

      {/* 안내 문구 */}
      <div style={guideSection}>
        <div style={guideRow}>
          <span style={badge('#2e7d32')}>출근</span>
          <span style={guideText}>앱 로그인 후 이 QR을 스캔하세요</span>
        </div>
        <div style={guideRow}>
          <span style={badge('#1565c0')}>이동</span>
          <span style={guideText}>다른 현장으로 이동 시 해당 현장 QR 스캔</span>
        </div>
        <div style={guideRow}>
          <span style={badge('#b71c1c')}>퇴근</span>
          <span style={guideText}>퇴근 현장 QR을 스캔하세요</span>
        </div>
      </div>

      {/* 주의사항 */}
      <div style={noticeBox}>
        <strong>주의사항</strong>
        <ul style={noticeList}>
          <li>GPS를 반드시 허용한 상태로 스캔하세요.</li>
          <li>현장 밖에서 스캔하면 오류가 발생할 수 있습니다.</li>
          <li>퇴근 후 앱을 꺼도 기록은 저장됩니다.</li>
          <li>문제 발생 시 현장 관리자에게 즉시 알려주세요.</li>
        </ul>
      </div>

      {/* URL */}
      <div style={urlLine}>
        접속 주소: <strong>{targetUrl}</strong>
      </div>

      {/* 문의 */}
      <div style={contactLine}>
        문의: 현장 관리자 연락처 확인 &nbsp;|&nbsp; 서비스: {baseUrl}
      </div>
    </div>
  )
}

// ── 스타일 ────────────────────────────────────────────────────────────

const centerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
}
const controlBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '12px 24px',
  background: '#1a1a2e', position: 'sticky' as const, top: 0, zIndex: 100,
}
const backLink: React.CSSProperties = {
  color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '14px',
}
const printBtn: React.CSSProperties = {
  padding: '10px 24px', background: '#1976d2', color: 'white',
  border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 700,
}
const printArea: React.CSSProperties = {
  background: '#f0f0f0', padding: '24px',
}

// A4 카드 (210mm ≈ 794px @ 96dpi, 한 장에 1현장)
const card: React.CSSProperties = {
  width: '794px',
  minHeight: '1120px',
  margin: '0 auto 24px',
  background: 'white',
  borderRadius: '12px',
  padding: '48px',
  boxSizing: 'border-box' as const,
  fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '20px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
}
const cardHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  paddingBottom: '16px', borderBottom: '3px solid #1a1a2e',
}
const cardTitle: React.CSSProperties = {
  fontSize: '22px', fontWeight: 700, color: '#1a1a2e',
}
const cardDate: React.CSSProperties = {
  fontSize: '15px', color: '#666',
}
const siteName: React.CSSProperties = {
  fontSize: '52px', fontWeight: 900, color: '#1a1a2e', textAlign: 'center' as const,
  lineHeight: 1.2,
}
const siteAddress: React.CSSProperties = {
  fontSize: '18px', color: '#888', textAlign: 'center' as const, marginTop: '-8px',
}
const qrWrapper: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  padding: '24px',
}
const qrImage: React.CSSProperties = {
  width: '360px', height: '360px',
  border: '2px solid #e0e0e0', borderRadius: '12px',
}
const guideSection: React.CSSProperties = {
  background: '#f8f9fa', borderRadius: '10px', padding: '20px 24px',
  display: 'flex', flexDirection: 'column' as const, gap: '12px',
}
const guideRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px',
}
const guideText: React.CSSProperties = {
  fontSize: '18px', color: '#333',
}
const badge = (color: string): React.CSSProperties => ({
  background: color, color: 'white', borderRadius: '6px',
  padding: '4px 12px', fontSize: '16px', fontWeight: 700, minWidth: '48px',
  textAlign: 'center' as const, flexShrink: 0,
})
const noticeBox: React.CSSProperties = {
  border: '2px solid #ff9800', borderRadius: '10px', padding: '16px 20px',
  fontSize: '15px', color: '#555',
}
const noticeList: React.CSSProperties = {
  margin: '8px 0 0', paddingLeft: '20px', lineHeight: '1.8',
}
const urlLine: React.CSSProperties = {
  fontSize: '13px', color: '#aaa', textAlign: 'center' as const,
}
const contactLine: React.CSSProperties = {
  fontSize: '14px', color: '#999', textAlign: 'center' as const,
  borderTop: '1px solid #eee', paddingTop: '12px', marginTop: 'auto',
}
