'use client'

import { useState, useEffect, useCallback } from 'react'

interface PolicyItem {
  docType: string
  label: string
  isRequired: boolean
  isActive: boolean
  sortOrder: number
  isCustom: boolean
}

interface Props {
  siteId: string
}

export function DocumentPolicyTab({ siteId }: Props) {
  const [policies, setPolicies] = useState<PolicyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasCustom, setHasCustom] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/document-policy`)
      const json = await res.json()
      if (json.success) {
        setPolicies(json.data.policies)
        setHasCustom(json.data.hasCustomPolicy)
        setDirty(false)
      }
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { load() }, [load])

  const toggle = (idx: number, field: 'isRequired' | 'isActive') => {
    setPolicies(prev => prev.map((p, i) =>
      i === idx ? { ...p, [field]: !p[field] } : p
    ))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/document-policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policies: policies.map((p, idx) => ({
            docType: p.docType,
            isRequired: p.isRequired,
            isActive: p.isActive,
            sortOrder: idx,
          })),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setDirty(false)
        setHasCustom(true)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-brand py-8 text-center">불러오는 중...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-semibold text-body-brand">문서 정책</h2>
          <p className="text-xs text-muted-brand mt-1">
            {hasCustom
              ? '이 현장에 맞춤 문서정책이 설정되어 있습니다.'
              : '기본 정책 사용 중 (5종 문서 전체 필수). 수정하면 이 현장만 적용됩니다.'}
          </p>
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        )}
      </div>

      <div className="bg-card rounded border border-brand overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-left text-muted-brand">
              <th className="px-4 py-3 font-medium">문서 유형</th>
              <th className="px-4 py-3 font-medium text-center w-24">활성</th>
              <th className="px-4 py-3 font-medium text-center w-24">필수</th>
              <th className="px-4 py-3 font-medium text-center w-24">상태</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p, idx) => (
              <tr key={p.docType} className="border-t border-brand">
                <td className="px-4 py-3">
                  <span className={p.isActive ? 'text-fore-brand' : 'text-muted2-brand line-through'}>
                    {p.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggle(idx, 'isActive')}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      p.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card transition-transform ${
                      p.isActive ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  {p.isActive ? (
                    <button
                      onClick={() => toggle(idx, 'isRequired')}
                      className={`px-3 py-1 text-xs rounded-full border ${
                        p.isRequired
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}
                    >
                      {p.isRequired ? '필수' : '선택'}
                    </button>
                  ) : (
                    <span className="text-xs text-muted2-brand">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {p.isActive && p.isRequired && (
                    <span className="text-xs text-red-500">출근 차단 대상</span>
                  )}
                  {p.isActive && !p.isRequired && (
                    <span className="text-xs text-muted-brand">제출 권장</span>
                  )}
                  {!p.isActive && (
                    <span className="text-xs text-muted2-brand">비활성</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted2-brand mt-3">
        필수 문서가 미완료된 근로자는 출근이 차단됩니다. 선택 문서는 제출을 권장하지만 출근에 영향하지 않습니다.
      </p>
    </div>
  )
}
