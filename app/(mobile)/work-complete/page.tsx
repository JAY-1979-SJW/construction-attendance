'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'
import SignatureCanvas from '@/components/common/SignatureCanvas'

interface SiteInfo { siteId: string; siteName: string }

export default function WorkCompletePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [sites, setSites] = useState<SiteInfo[]>([])
  const [siteId, setSiteId] = useState('')
  const [healthChecked, setHealthChecked] = useState(false)
  const [workNoIssue, setWorkNoIssue] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [doneAt, setDoneAt] = useState<string | null>(null)
  const [photos, setPhotos] = useState<{ base64: string; preview: string }[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/attendance/available-sites').then(r => r.json()),
      fetch('/api/worker/work-complete').then(r => r.json()),
    ]).then(([sitesData, statusData]) => {
      if (sitesData.success) {
        const s = (sitesData.sites || []).map((x: any) => ({ siteId: x.siteId, siteName: x.siteName }))
        setSites(s)
        if (s.length === 1) setSiteId(s[0].siteId)
      }
      if (statusData.success && statusData.data.healthChecked) {
        setAlreadyDone(true)
        setDoneAt(statusData.data.healthCheckedAt)
      }
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || photos.length >= 5) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      setPhotos(prev => [...prev, { base64, preview: result }])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    setError(''); setSuccess('')
    if (!siteId) { setError('현장을 선택하세요.'); return }
    if (!workNoIssue) { setError('작업 이상 없음을 확인해 주세요.'); return }
    if (!healthChecked) { setError('건강이상 없음을 확인해 주세요.'); return }
    if (!signatureData) { setError('서명을 해주세요.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/worker/work-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          healthCheckedYn: healthChecked,
          healthSignature: signatureData,
          photos: photos.length > 0 ? photos.map(p => ({ base64: p.base64, mimeType: 'image/jpeg' })) : undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccess(json.message)
        setAlreadyDone(true)
        setDoneAt(new Date().toISOString())
      } else {
        setError(json.error || json.message || '제출 실패')
      }
    } catch { setError('네트워크 오류') }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <WorkerTopBar />
      <div className="px-4 pt-4">
        <h2 className="text-lg font-bold text-gray-800 mb-1">작업완료 보고</h2>
        <p className="text-[13px] leading-5 text-gray-500 mb-4">퇴근 전 작업 완료 사진을 촬영하고, 건강 이상 없음을 확인합니다.</p>

        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">불러오는 중...</div>
        ) : alreadyDone ? (
          <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600 text-[18px]">✓</span>
              <span className="text-base font-bold text-green-700">오늘 작업완료 보고 완료</span>
            </div>
            {doneAt && (
              <div className="text-[13px] leading-5 text-green-600">
                확인 시각: {new Date(doneAt).toLocaleString('ko-KR')}
              </div>
            )}
            <button onClick={() => router.push('/attendance')}
              className="w-full mt-4 h-11 rounded-xl text-sm font-bold bg-green-600 text-white border-none cursor-pointer">
              출퇴근 화면으로 이동
            </button>
          </div>
        ) : (
          <div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-[13px] leading-5 text-red-700">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-[13px] leading-5 text-green-700">{success}</div>}

            {/* 현장 선택 */}
            {sites.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">현장</label>
                <select className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base bg-white outline-none focus:border-[#F97316] box-border"
                  value={siteId} onChange={e => setSiteId(e.target.value)}>
                  <option value="">현장 선택</option>
                  {sites.map(s => <option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}
                </select>
              </div>
            )}

            {/* 작업완료 사진 */}
            <div className="bg-card rounded-2xl p-4 mb-4 border border-brand">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-gray-700">작업완료 사진</label>
                <span className="text-[13px] leading-5 text-gray-400">{photos.length}/5장</span>
              </div>

              <div className="flex gap-2 flex-wrap mb-3">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(idx)}
                      className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white text-xs rounded-bl-lg border-none cursor-pointer">X</button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-[24px] cursor-pointer bg-gray-50 hover:border-[#F97316]">
                    +
                  </button>
                )}
              </div>
              <p className="text-[13px] leading-5 text-gray-400">작업 완료 상태를 촬영하여 첨부하세요.</p>
            </div>

            {/* 작업 이상 없음 확인서 */}
            <div className="bg-card rounded-2xl p-4 mb-4 border border-brand">
              <label className="text-sm font-semibold text-gray-700 block mb-3">작업 완료 확인서</label>

              <div className="bg-blue-50 rounded-xl p-4 mb-3 text-[13px] text-gray-600 leading-relaxed">
                <p className="font-semibold text-gray-700 mb-2">본인은 금일 담당 작업을 완료하며 아래 사항을 확인합니다.</p>
                <ul className="list-none p-0 m-0 space-y-1.5">
                  <li>1. 작업 중 안전사고가 발생하지 않았습니다.</li>
                  <li>2. 작업 결과물에 하자 또는 이상이 없습니다.</li>
                  <li>3. 자재·장비의 파손 또는 분실이 없습니다.</li>
                  <li>4. 작업 구역 정리정돈을 완료했습니다.</li>
                </ul>
                <p className="mt-2 text-[13px] leading-5 text-gray-400">이상이 있는 경우 체크하지 마시고 관리자에게 즉시 보고하세요.</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-colors"
                style={{
                  borderColor: workNoIssue ? '#1565C0' : '#E5E7EB',
                  background: workNoIssue ? '#EFF6FF' : 'white',
                }}>
                <input type="checkbox" checked={workNoIssue} onChange={e => setWorkNoIssue(e.target.checked)}
                  className="w-5 h-5 accent-blue-600" />
                <div>
                  <div className={`text-[14px] font-bold ${workNoIssue ? 'text-blue-700' : 'text-gray-600'}`}>
                    작업 완료 시 이상 없음을 확인합니다
                  </div>
                  <div className="text-[13px] leading-5 text-gray-400 mt-0.5">사고·하자·파손·분실이 있으면 체크하지 마세요.</div>
                </div>
              </label>
            </div>

            {/* 건강이상 없음 확인 */}
            <div className="bg-card rounded-2xl p-4 mb-4 border border-brand">
              <label className="text-sm font-semibold text-gray-700 block mb-3">건강이상 없음 확인</label>

              <div className="bg-gray-50 rounded-xl p-4 mb-3 text-[13px] text-gray-600 leading-relaxed">
                <p>본인은 금일 작업을 마치며, 작업 중 및 현재 시점에서 건강에 이상이 없음을 확인합니다.</p>
                <p className="mt-2">두통, 어지러움, 호흡곤란, 근골격계 통증, 피부 이상 등 이상 증상이 있는 경우 반드시 관리자에게 즉시 보고하세요.</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-colors"
                style={{
                  borderColor: healthChecked ? '#16A34A' : '#E5E7EB',
                  background: healthChecked ? '#F0FDF4' : 'white',
                }}>
                <input type="checkbox" checked={healthChecked} onChange={e => setHealthChecked(e.target.checked)}
                  className="w-5 h-5 accent-green-600" />
                <div>
                  <div className={`text-[14px] font-bold ${healthChecked ? 'text-green-700' : 'text-gray-600'}`}>
                    건강이상 없음을 확인합니다
                  </div>
                  <div className="text-[13px] leading-5 text-gray-400 mt-0.5">이상 증상이 있으면 체크하지 마시고 관리자에게 보고하세요.</div>
                </div>
              </label>
            </div>

            {/* 서명 */}
            {workNoIssue && healthChecked && (
              <div className="bg-card rounded-2xl p-4 mb-4 border border-brand">
                <label className="text-sm font-semibold text-gray-700 block mb-2">작업완료 + 건강확인 서명</label>
                <p className="text-[13px] leading-5 text-gray-500 mb-3">
                  본인은 금일 작업 완료 시 이상이 없었으며, 건강에도 이상이 없음을 아래 서명으로 확인합니다.
                </p>
                <SignatureCanvas
                  onSave={(dataUri) => setSignatureData(dataUri)}
                  width={340}
                  height={140}
                  accentColor="#16A34A"
                  disabled={submitting}
                />
                {signatureData && (
                  <div className="text-[13px] leading-5 text-green-600 mt-2 text-center">서명 완료</div>
                )}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !workNoIssue || !healthChecked || !signatureData}
              className="w-full h-12 rounded-xl text-sm font-bold text-white border-none cursor-pointer disabled:bg-gray-300"
              style={{ background: workNoIssue && healthChecked && signatureData ? '#16A34A' : '#9CA3AF' }}
            >
              {submitting ? '제출 중...' : !workNoIssue ? '작업확인을 체크하세요' : !healthChecked ? '건강확인을 체크하세요' : !signatureData ? '서명을 해주세요' : '작업완료 확인서 제출'}
            </button>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
      <WorkerBottomNav />
    </div>
  )
}
