'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageShell, SectionCard, Btn, FilterSelect } from '@/components/admin/ui'

interface Location {
  id: string; siteId: string; buildingName: string
  floorOrder: number; floorLabel: string; detailLabel: string | null
  isActive: boolean; sortOrder: number
}

interface SiteOption { id: string; name: string }

export default function SiteLocationsPage() {
  const [sites, setSites] = useState<SiteOption[]>([])
  const [siteId, setSiteId] = useState('')
  const [items, setItems] = useState<Location[]>([])
  const [buildings, setBuildings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // 생성 폼
  const [genBuildings, setGenBuildings] = useState('A동, B동')
  const [genUnder, setGenUnder] = useState(-2)
  const [genAbove, setGenAbove] = useState(30)
  const [genSpecials, setGenSpecials] = useState('옥탑, PIT, 기계실, 전기실')

  // 현장 목록
  useEffect(() => {
    fetch('/api/admin/sites?limit=200')
      .then((r) => r.json())
      .then((d) => { if (d.success) setSites((d.data.items || d.data || []).map((s: any) => ({ id: s.id, name: s.name }))) })
      .catch(() => {})
  }, [])

  // 위치 로딩
  const fetchLocations = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const res = await fetch(`/api/admin/site-locations?siteId=${siteId}`)
    const data = await res.json()
    if (data.success) {
      setItems(data.data.items || [])
      setBuildings(data.data.buildings || [])
    }
    setLoading(false)
  }, [siteId])

  useEffect(() => { fetchLocations() }, [fetchLocations])

  // 템플릿 생성
  const handleGenerate = async () => {
    if (!siteId) return
    setMsg('')
    const blds = genBuildings.split(',').map((s) => s.trim()).filter(Boolean)
    const sps = genSpecials.split(',').map((s) => s.trim()).filter(Boolean)

    const res = await fetch('/api/admin/site-locations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId,
        buildings: blds,
        undergroundStart: genUnder,
        abovegroundEnd: genAbove,
        specials: sps,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setMsg(data.message || `${data.data.created}개 생성`)
      fetchLocations()
    } else {
      setMsg(data.message || '생성 실패')
    }
  }

  // 비활성화 토글
  const toggleActive = async (item: Location) => {
    await fetch('/api/admin/site-locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    })
    fetchLocations()
  }

  return (
    <PageShell>

      {/* 현장 선택 */}
      <SectionCard className="mb-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <div className="text-[12px] text-muted2-brand mb-1">현장</div>
            <FilterSelect value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">현장 선택</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FilterSelect>
          </div>
        </div>
      </SectionCard>

      {siteId && (
        <>
          {/* 템플릿 생성 */}
          <SectionCard className="mb-4">
            <div className="text-[14px] font-semibold text-body-brand mb-3">템플릿 자동생성</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <div className="text-[11px] text-muted2-brand mb-1">동 (쉼표 구분)</div>
                <input type="text" value={genBuildings} onChange={(e) => setGenBuildings(e.target.value)}
                  className="w-full border border-brand rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent" />
              </div>
              <div>
                <div className="text-[11px] text-muted2-brand mb-1">특수구역 (쉼표 구분)</div>
                <input type="text" value={genSpecials} onChange={(e) => setGenSpecials(e.target.value)}
                  className="w-full border border-brand rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent" />
              </div>
              <div>
                <div className="text-[11px] text-muted2-brand mb-1">지하 시작층 (예: -2)</div>
                <input type="number" value={genUnder} onChange={(e) => setGenUnder(Number(e.target.value))}
                  className="w-full border border-brand rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent" />
              </div>
              <div>
                <div className="text-[11px] text-muted2-brand mb-1">지상 종료층 (예: 30)</div>
                <input type="number" value={genAbove} onChange={(e) => setGenAbove(Number(e.target.value))}
                  className="w-full border border-brand rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div className="flex gap-2 mt-3 items-center">
              <Btn variant="orange" onClick={handleGenerate}>자동생성</Btn>
              {msg && <span className="text-[13px] text-accent">{msg}</span>}
            </div>
          </SectionCard>

          {/* 위치 목록 */}
          <SectionCard>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[14px] font-semibold text-body-brand">
                위치 목록 ({items.length}개 / {buildings.length}개 동)
              </div>
            </div>

            {loading ? (
              <div className="text-[13px] text-muted2-brand py-4 text-center">로딩 중...</div>
            ) : items.length === 0 ? (
              <div className="text-[13px] text-muted2-brand py-4 text-center">위치가 없습니다. 템플릿으로 생성하세요.</div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[11px] text-muted2-brand border-b border-brand">
                      <th className="py-2 font-normal">동</th>
                      <th className="py-2 font-normal">층</th>
                      <th className="py-2 font-normal">상세위치</th>
                      <th className="py-2 font-normal text-center">상태</th>
                      <th className="py-2 font-normal text-center">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-[#F9FAFB]"
                        style={{ opacity: item.isActive ? 1 : 0.4 }}>
                        <td className="py-2 text-body-brand">{item.buildingName}</td>
                        <td className="py-2 text-body-brand">{item.floorLabel}</td>
                        <td className="py-2 text-muted-brand">{item.detailLabel || '-'}</td>
                        <td className="py-2 text-center">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                            item.isActive ? 'bg-green-light text-status-working' : 'bg-footer text-muted2-brand'
                          }`}>
                            {item.isActive ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <button onClick={() => toggleActive(item)}
                            className="text-[11px] text-muted-brand hover:text-accent transition-colors">
                            {item.isActive ? '비활성화' : '활성화'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </PageShell>
  )
}
