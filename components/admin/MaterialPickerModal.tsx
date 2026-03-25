'use client'

import { useState, useEffect, useCallback } from 'react'

interface Material {
  id: string
  itemCode: string
  standardItemName: string
  standardSpec: string | null
  standardUnit: string | null
  disciplineCode: string | null
  subDisciplineCode: string | null
}

interface PickerItem {
  materialMasterId: string
  itemCode: string
  itemName: string
  spec: string | null
  unit: string | null
  disciplineCode: string | null
  requestedQty: number
  isUrgent: boolean
  allowSubstitute: boolean
  notes: string
}

interface Props {
  onAdd: (item: PickerItem) => void
  onClose: () => void
}

const DISCIPLINE_OPTIONS = [
  { code: '', label: '전체 공종' },
  { code: 'M', label: '설비공사' },
  { code: 'A', label: '건축공사' },
  { code: 'E', label: '전기공사' },
  { code: 'C', label: '토목공사' },
  { code: 'T', label: '통신공사' },
  { code: 'ETC', label: '기타' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

export default function MaterialPickerModal({ onAdd, onClose }: Props) {
  const [q, setQ] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Material[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [selected, setSelected] = useState<Material | null>(null)
  const [qty, setQty] = useState('1')
  const [isUrgent, setIsUrgent] = useState(false)
  const [allowSub, setAllowSub] = useState(false)
  const [notes, setNotes] = useState('')

  const dq = useDebounce(q, 300)
  const pageSize = 15

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (dq) params.set('q', dq)
    if (discipline) params.set('disciplineCode', discipline)
    fetch(`/api/admin/materials/requestable?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setItems(d.data.items); setTotal(d.data.total) }
      })
      .finally(() => setLoading(false))
  }, [dq, discipline, page])

  useEffect(() => { setPage(1) }, [dq, discipline])
  useEffect(() => { load() }, [load])

  const handleAdd = () => {
    if (!selected) return
    const q2 = parseFloat(qty)
    if (!q2 || q2 <= 0) { alert('수량을 올바르게 입력하세요.'); return }
    onAdd({
      materialMasterId: selected.id,
      itemCode:         selected.itemCode,
      itemName:         selected.standardItemName,
      spec:             selected.standardSpec,
      unit:             selected.standardUnit,
      disciplineCode:   selected.disciplineCode,
      requestedQty:     q2,
      isUrgent,
      allowSubstitute:  allowSub,
      notes,
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>자재 선택</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* 검색 필터 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            placeholder="품목명, 규격, 코드 검색..."
            value={q} onChange={e => setQ(e.target.value)}
            style={S.input}
          />
          <select value={discipline} onChange={e => setDiscipline(e.target.value)} style={S.select}>
            {DISCIPLINE_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </div>

        {/* 자재 목록 */}
        <div style={S.tableWrap}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#A0AEC0' }}>검색 중...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#A0AEC0' }}>
              {q ? '검색 결과가 없습니다.' : '품명, 규격, 단위, 분류로 검색할 수 있습니다.'}
            </div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['품목명', '규격', '단위', '공종'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    style={{
                      ...S.tr,
                      background: selected?.id === item.id ? 'rgba(244,121,32,0.15)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={S.td}>{item.standardItemName}</td>
                    <td style={S.td}>{item.standardSpec ?? '-'}</td>
                    <td style={S.td}>{item.standardUnit ?? '-'}</td>
                    <td style={S.td}>{item.disciplineCode ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '8px 0' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.pgBtn}>이전</button>
            <span style={{ color: '#A0AEC0', fontSize: '13px', lineHeight: '32px' }}>{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.pgBtn}>다음</button>
          </div>
        )}

        {/* 선택된 항목 입력 */}
        {selected && (
          <div style={S.selectedBox}>
            <div style={{ fontSize: '13px', color: '#A0AEC0', marginBottom: '8px' }}>
              선택: <strong style={{ color: '#111827' }}>{selected.standardItemName}</strong>
              {selected.standardSpec && <span> / {selected.standardSpec}</span>}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={S.label}>
                수량 ({selected.standardUnit ?? '?'})
                <input
                  type="number" min="0.01" step="0.01" value={qty}
                  onChange={e => setQty(e.target.value)}
                  style={{ ...S.input, width: '100px' }}
                />
              </label>
              <label style={{ ...S.label, flexDirection: 'row', gap: '6px', alignItems: 'center' }}>
                <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} />
                긴급
              </label>
              <label style={{ ...S.label, flexDirection: 'row', gap: '6px', alignItems: 'center' }}>
                <input type="checkbox" checked={allowSub} onChange={e => setAllowSub(e.target.checked)} />
                대체품 허용
              </label>
            </div>
            <label style={S.label}>
              비고
              <input value={notes} onChange={e => setNotes(e.target.value)} style={S.input} placeholder="비고 (선택)" />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={S.cancelBtn}>취소</button>
          <button onClick={handleAdd} disabled={!selected} style={S.addBtn}>
            추가
          </button>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { background: '#FFFFFF', borderRadius: '12px', padding: '24px', width: '760px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid #E5E7EB' },
  closeBtn: { background: 'transparent', border: 'none', color: '#6B7280', fontSize: '18px', cursor: 'pointer' },
  input: { flex: 1, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '14px', background: '#F9FAFB', color: '#111827', display: 'flex', flexDirection: 'column', gap: '4px' },
  select: { padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '14px', background: '#F9FAFB', color: '#111827' },
  tableWrap: { flex: 1, overflowY: 'auto', minHeight: '180px', maxHeight: '300px', border: '1px solid #E5E7EB', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#4B5563', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, background: '#F3F4F6' },
  td: { padding: '8px 12px', fontSize: '13px', borderBottom: '1px solid #F3F4F6', color: '#374151' },
  tr: {},
  pgBtn: { padding: '4px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', color: '#374151', cursor: 'pointer', fontSize: '13px' },
  selectedBox: { background: '#FFF7ED', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', padding: '12px 16px', marginTop: '12px' },
  label: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#6B7280' },
  cancelBtn: { padding: '8px 20px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#6B7280', cursor: 'pointer', fontSize: '14px' },
  addBtn: { padding: '8px 24px', background: '#F97316', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
}
