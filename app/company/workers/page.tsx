'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Worker {
  id: string
  name: string
  phone: string
  jobTitle: string
  employmentType: string
  isActive: boolean
  activeSites?: { id: string; name: string }[]
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  DAILY_CONSTRUCTION: '?ºÏö©Ïß?,
  REGULAR: '?ïÍ∑úÏß?,
  BUSINESS_33: '?¨ÏóÖ?åÎìù(3.3%)',
  OTHER: 'Í∏∞Ì?',
}

const emptyForm = { name: '', phone: '', jobTitle: '', employmentType: 'DAILY_CONSTRUCTION' }

export default function CompanyWorkersPage() {
  const router = useRouter()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = (s = search) => {
    setLoading(true)
    fetch(`/api/company/workers?search=${encodeURIComponent(s)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/company/login'); return }
        setWorkers(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/company/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) { setFormError(data.message); return }
      setMsg('Í∑ºÎ°ú?êÍ? ?±Î°ù?òÏóà?µÎãà??')
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch {
      setFormError('?§Ìä∏?åÌÅ¨ ?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.')
    } finally {
      setSaving(false)
    }
  }

  const formatPhone = (p: string) => p.length === 11 ? `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` : p

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold m-0 text-white">Í∑ºÎ°ú??Í¥ÄÎ¶?({total}Î™?</h1>
        <button
          onClick={() => { setShowForm(true); setFormError('') }}
          className="px-4 py-2 bg-[#F97316] text-white border-none rounded-[7px] cursor-pointer text-sm font-semibold"
        >
          + Í∑ºÎ°ú???±Î°ù
        </button>
      </div>

      {msg && (
        <p className="bg-[#e8f5e9] text-[#2e7d32] px-3.5 py-2.5 rounded-[6px] mb-4 text-sm">{msg}</p>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="?¥Î¶Ñ?ºÎ°ú Í≤Ä??
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-[7px] text-sm w-[220px] outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[#555] text-white border-none rounded-[7px] cursor-pointer text-sm"
        >
          Í≤Ä??        </button>
      </form>

      {loading ? (
        <p className="text-muted-brand text-[15px]">Î∂àÎü¨?§Îäî Ï§?..</p>
      ) : (
        <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.07)] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['?¥Î¶Ñ', '?∞ÎùΩÏ≤?, 'ÏßÅÏ¢Ö', 'Í≥†Ïö©?ïÌÉú', 'Ï∂úÍ∑º?ÑÏû•', '?ÅÌÉú'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[#eee] bg-[#fafafa] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-[#aaa] text-sm">Í∑ºÎ°ú?êÍ? ?ÜÏäµ?àÎã§.</td></tr>
              ) : workers.map((w) => (
                <tr key={w.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-3 text-sm text-[#CBD5E0] whitespace-nowrap">{w.name}</td>
                  <td className="px-4 py-3 text-sm text-[#CBD5E0] whitespace-nowrap">{formatPhone(w.phone)}</td>
                  <td className="px-4 py-3 text-sm text-[#CBD5E0] whitespace-nowrap">{w.jobTitle}</td>
                  <td className="px-4 py-3 text-sm text-[#CBD5E0] whitespace-nowrap">{EMPLOYMENT_TYPE_LABEL[w.employmentType] ?? w.employmentType}</td>
                  <td className="px-4 py-3 text-sm text-[#CBD5E0] whitespace-nowrap">{w.activeSites?.map((s) => s.name).join(', ') || '-'}</td>
                  <td className="px-4 py-3 text-sm text-[#CBD5E0] whitespace-nowrap">
                    <span
                      className="px-2 py-0.5 rounded text-[12px] font-semibold"
                      style={{
                        background: w.isActive ? '#e8f5e9' : '#fafafa',
                        color: w.isActive ? '#2e7d32' : '#888',
                      }}
                    >
                      {w.isActive ? '?úÏÑ±' : 'ÎπÑÌôú??}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[1000]">
          <div className="bg-card rounded-xl p-8 w-full max-w-[420px] shadow-[0_8px_40px_rgba(0,0,0,0.2)]">
            <h2 className="text-lg font-bold m-0 mb-5 text-white">Í∑ºÎ°ú???±Î°ù</h2>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold text-muted-brand mb-1.5">?¥Î¶Ñ</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-base w-full"
                placeholder="?çÍ∏∏??
              />
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold text-muted-brand mb-1.5">?∞ÎùΩÏ≤?/label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-base w-full"
                placeholder="01012345678"
              />
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold text-muted-brand mb-1.5">ÏßÅÏ¢Ö</label>
              <input
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                className="input-base w-full"
                placeholder="Ï≤†Í∑ºÍ≥?
              />
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold text-muted-brand mb-1.5">Í≥†Ïö©?ïÌÉú</label>
              <select
                value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-[rgba(91,164,217,0.3)] rounded-[7px] outline-none bg-card box-border"
              >
                <option value="DAILY_CONSTRUCTION">?ºÏö©Ïß?/option>
                <option value="REGULAR">?ïÍ∑úÏß?/option>
                <option value="BUSINESS_33">?¨ÏóÖ?åÎìù(3.3%)</option>
                <option value="OTHER">Í∏∞Ì?</option>
              </select>
            </div>
            {formError && <p className="text-[#e53935] text-[13px] mb-2.5">{formError}</p>}
            <div className="flex gap-2.5 justify-end mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-[#eee] text-muted-brand border-none rounded-[7px] cursor-pointer text-sm"
              >
                Ï∑®ÏÜå
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#F97316] text-white border-none rounded-[7px] cursor-pointer text-sm font-semibold"
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? '?Ä??Ï§?..' : '?±Î°ù'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
