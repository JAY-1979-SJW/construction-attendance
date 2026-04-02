'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-11 px-3 pr-11 text-[14px] border border-brand rounded-lg bg-card text-fore-brand outline-none focus:border-accent" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-muted-brand hover:text-fore-brand p-1">
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}

interface PolicyDoc {
  id: string
  documentType: string
  title: string
  version: string
  contentMd: string
  isRequired: boolean
}

/* ── 스텝 인디케이터 ─────────────────────────────── */
function StepBar({ current }: { current: number }) {
  const steps = ['약관동의', '소셜인증', '정보입력', '승인대기']
  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {steps.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={label} className="flex flex-col items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold mb-1 transition-colors ${
              done ? 'bg-green-600 text-white' : active ? 'bg-brand-accent text-white' : 'bg-brand-deeper text-muted2-brand'
            }`}>
              {done ? '✓' : step}
            </div>
            <span className={`text-[11px] ${active ? 'text-accent font-semibold' : 'text-muted2-brand'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

type RegMethod = 'select' | 'oauth' | 'email'

function RegisterContent() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const params = useSearchParams()
  const errorKey = params.get('error') ?? ''

  const [method, setMethod] = useState<RegMethod>('select')
  const [policyDocs, setPolicyDocs] = useState<PolicyDoc[]>([])
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [error, setError] = useState('')

  // 이메일/비번 가입 폼
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regJobTitle, setRegJobTitle] = useState('')
  const [regBirthDate, setRegBirthDate] = useState('')

  const allRequired = consentTerms && consentPrivacy

  const handleEmailRegister = async () => {
    if (!allRequired) { setError('필수 동의 항목을 모두 체크해 주세요.'); return }
    if (!regEmail || !regPassword || !regName || !regJobTitle) { setError('필수 항목을 모두 입력하세요.'); return }
    if (regPassword.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (regPassword !== regPasswordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    setError('')
    setLoading('email')
    try {
      const res = await fetch('/api/auth/worker-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          name: regName,
          phone: regPhone || undefined,
          jobTitle: regJobTitle,
          birthDate: regBirthDate || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message || '가입에 실패했습니다.')
        setLoading(null)
        return
      }
      router.push('/register/pending')
    } catch {
      setError('서버 오류가 발생했습니다.')
      setLoading(null)
    }
  }

  useEffect(() => {
    fetch('/api/policies/active')
      .then(r => r.json())
      .then(d => { if (d.success) setPolicyDocs(d.documents ?? []) })
      .catch(() => {})
  }, [])

  const ERROR_MSG: Record<string, string> = {
    no_email: '이메일 정보를 가져올 수 없습니다.',
    inactive: '비활성화된 계정입니다. 관리자에게 문의하세요.',
    server: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    already_registered: '이미 가입된 계정입니다. 로그인해 주세요.',
  }

  function getDoc(type: string) {
    return policyDocs.find(d => d.documentType === type)
  }

  function handleSignUp(provider: string) {
    if (!allRequired) {
      setError('필수 동의 항목을 모두 체크해 주세요.')
      return
    }
    setError('')
    setLoading(provider)
    const consent = JSON.stringify({
      terms: consentTerms, privacy: consentPrivacy,
      marketing: consentMarketing,
      documentIds: Object.fromEntries(policyDocs.map(d => [d.documentType, d.id])),
    })
    // httpOnly 쿠키로 서버 발급 후 OAuth 진행
    fetch('/api/auth/register-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent }),
    }).then(() => {
      signIn(provider, { callbackUrl: '/api/auth/complete' })
    })
  }

  function handleCheckAll(checked: boolean) {
    setConsentTerms(checked)
    setConsentPrivacy(checked)
    setConsentMarketing(checked)
  }

  const allChecked = consentTerms && consentPrivacy && consentMarketing

  const termsDoc = getDoc('TERMS_OF_SERVICE')
  const privacyDoc = getDoc('PRIVACY_POLICY')
  const marketingDoc = getDoc('MARKETING_NOTICE')

  // ── 가입 방법 선택 화면 ──
  if (method === 'select') {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl px-8 py-9 w-full max-w-[480px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-brand border-t-[3px] border-t-accent">
          <div className="text-center mb-4">
            <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[140px] h-auto mx-auto block rounded-2xl" priority />
          </div>
          <h1 className="text-[20px] font-extrabold text-fore-brand tracking-[-0.5px] mb-1">회원가입</h1>
          <p className="text-[13px] text-muted-brand leading-[1.6] mb-6">가입 유형을 선택해 주세요.</p>

          <div className="space-y-3 mb-5">
            <button onClick={() => setMethod('oauth')}
              className="w-full py-5 rounded-[14px] border-2 border-brand bg-card text-left px-5 hover:border-accent hover:bg-accent-light transition-all cursor-pointer">
              <div className="text-[15px] font-bold text-fore-brand mb-1">근로자 — 소셜 가입</div>
              <div className="text-[12px] text-muted-brand">Google 또는 카카오 계정으로 간편 가입</div>
            </button>
            <button onClick={() => setMethod('email')}
              className="w-full py-5 rounded-[14px] border-2 border-brand bg-card text-left px-5 hover:border-accent hover:bg-accent-light transition-all cursor-pointer">
              <div className="text-[15px] font-bold text-fore-brand mb-1">근로자 — 이메일 가입</div>
              <div className="text-[12px] text-muted-brand">이메일과 비밀번호로 직접 가입</div>
            </button>
            <Link href="/register/company-admin"
              className="block w-full py-5 rounded-[14px] border-2 border-brand bg-card text-left px-5 hover:border-accent hover:bg-accent-light transition-all no-underline">
              <div className="text-[15px] font-bold text-fore-brand mb-1">사업자 (업체 관리자)</div>
              <div className="text-[12px] text-muted-brand">사업자등록번호로 업체 관리자 신청</div>
            </Link>
          </div>

          <div className="text-center">
            <Link href="/login" className="text-accent text-[13px] no-underline font-medium">이미 계정이 있으신가요? 로그인</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── 이메일/비번 가입 ──
  if (method === 'email') {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl px-8 py-9 w-full max-w-[480px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-brand border-t-[3px] border-t-accent">
          <div className="text-center mb-4">
            <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[140px] h-auto mx-auto block rounded-2xl" priority />
          </div>
          <button onClick={() => setMethod('select')} className="text-[12px] text-muted-brand hover:text-accent bg-transparent border-none cursor-pointer p-0 mb-3">← 뒤로</button>
          <h1 className="text-[20px] font-extrabold text-fore-brand tracking-[-0.5px] mb-1">이메일로 가입</h1>
          <p className="text-[13px] text-muted-brand leading-[1.6] mb-5">정보를 입력하고 약관에 동의하면 가입됩니다.</p>

          {error && <div className="alert-danger mb-4">{error}</div>}

          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-1">이메일 *</label>
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="name@example.com"
                className="w-full h-11 px-3 text-[14px] border border-brand rounded-lg bg-card text-fore-brand outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-1">비밀번호 * (6자 이상)</label>
              <PasswordInput value={regPassword} onChange={setRegPassword} placeholder="비밀번호" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-1">비밀번호 확인 *</label>
              <PasswordInput value={regPasswordConfirm} onChange={setRegPasswordConfirm} placeholder="비밀번호 다시 입력" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-1">이름 (실명) *</label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="홍길동"
                className="w-full h-11 px-3 text-[14px] border border-brand rounded-lg bg-card text-fore-brand outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-1">직종 *</label>
              <input type="text" value={regJobTitle} onChange={e => setRegJobTitle(e.target.value)} placeholder="형틀목공, 전기공 등"
                className="w-full h-11 px-3 text-[14px] border border-brand rounded-lg bg-card text-fore-brand outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-1">전화번호</label>
              <input type="text" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="01012345678" maxLength={11} inputMode="numeric"
                className="w-full h-11 px-3 text-[14px] border border-brand rounded-lg bg-card text-fore-brand outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-1">생년월일</label>
              <input type="date" value={regBirthDate} onChange={e => setRegBirthDate(e.target.value)}
                className="w-full h-11 px-3 text-[14px] border border-brand rounded-lg bg-card text-fore-brand outline-none focus:border-accent" />
            </div>
          </div>

          {/* 약관 동의 (간소화) */}
          <div className="mb-5 p-4 bg-surface rounded-xl border border-brand">
            <label className="flex items-center gap-2 cursor-pointer pb-3 mb-3 border-b border-brand">
              <input type="checkbox" checked={allChecked} onChange={e => handleCheckAll(e.target.checked)} className="w-[18px] h-[18px] accent-brand-accent" />
              <span className="text-[14px] font-bold text-fore-brand">전체 동의</span>
            </label>
            {[
              { label: '서비스 이용약관 (필수)', checked: consentTerms, set: setConsentTerms },
              { label: '개인정보 수집·이용 동의 (필수)', checked: consentPrivacy, set: setConsentPrivacy },
              { label: '마케팅 정보 수신 동의 (선택)', checked: consentMarketing, set: setConsentMarketing },
            ].map(item => (
              <label key={item.label} className="flex items-center gap-2 cursor-pointer mb-1 text-[13px] text-body-brand">
                <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} className="w-4 h-4 accent-brand-accent" />
                {item.label}
              </label>
            ))}
          </div>

          <button onClick={handleEmailRegister} disabled={!!loading || !allRequired}
            className="w-full h-12 text-[15px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)] disabled:opacity-50 border-none cursor-pointer">
            {loading === 'email' ? '가입 처리 중...' : '가입하기'}
          </button>

          <div className="text-center mt-4">
            <Link href="/login" className="text-accent text-[13px] no-underline font-medium">이미 계정이 있으신가요? 로그인</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── OAuth 가입 (기존 흐름) ──
  return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl px-8 py-9 w-full max-w-[480px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-brand border-t-[3px] border-t-accent">
        <div className="text-center mb-4">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[140px] h-auto mx-auto block rounded-2xl" priority />
        </div>
        <button onClick={() => setMethod('select')} className="text-[12px] text-muted-brand hover:text-accent bg-transparent border-none cursor-pointer p-0 mb-3">← 뒤로</button>

        <StepBar current={1} />

        <h1 className="text-[20px] font-extrabold text-fore-brand tracking-[-0.5px] mb-1">소셜 계정으로 가입</h1>
        <p className="text-[13px] text-muted-brand leading-[1.6] mb-5">약관에 동의한 후 카카오 또는 Google로 가입합니다.</p>

        {(error || errorKey) && (
          <div className="alert-danger mb-4">
            {error || ERROR_MSG[errorKey] || '가입 중 오류가 발생했습니다.'}
          </div>
        )}

        {/* 약관 동의 */}
        <div className="mb-5 p-4 bg-surface rounded-xl border border-brand">
          {/* 전체 동의 */}
          <label className="flex items-center gap-2 cursor-pointer pb-3 mb-3 border-b border-brand">
            <input type="checkbox" checked={allChecked} onChange={e => handleCheckAll(e.target.checked)} className="w-[18px] h-[18px] accent-brand-accent" />
            <span className="text-[14px] font-bold text-fore-brand">전체 동의</span>
          </label>

          {[
            { key: 'TERMS_OF_SERVICE', label: '서비스 이용약관', doc: termsDoc, checked: consentTerms, set: setConsentTerms, required: true },
            { key: 'PRIVACY_POLICY', label: '개인정보 수집·이용 동의', doc: privacyDoc, checked: consentPrivacy, set: setConsentPrivacy, required: true },
            { key: 'MARKETING_NOTICE', label: '마케팅 정보 수신 동의', doc: marketingDoc, checked: consentMarketing, set: setConsentMarketing, required: false },
          ].map(item => (
            <div key={item.key} className="mb-2">
              <div className="flex items-center justify-between gap-2 text-[13px] text-body-brand">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} className="w-4 h-4 accent-brand-accent" />
                  <span>
                    <span className={item.required ? 'text-accent font-semibold' : 'text-muted2-brand'}>{item.required ? '필수' : '선택'}</span>{' '}
                    {item.doc ? item.doc.title : item.label}
                  </span>
                </label>
                {item.doc && (
                  <button type="button" className="text-[11px] text-muted-brand underline cursor-pointer bg-transparent border-0 p-0" onClick={() => setExpandedDoc(expandedDoc === item.key ? null : item.key)}>
                    {expandedDoc === item.key ? '닫기' : '보기'}
                  </button>
                )}
              </div>
              {expandedDoc === item.key && item.doc && (
                <div className="mt-1 ml-6 text-[11px] text-body-brand bg-card border border-brand rounded-lg p-3 max-h-[150px] overflow-y-auto whitespace-pre-wrap leading-[1.6]">{item.doc.contentMd}</div>
              )}
            </div>
          ))}
        </div>

        {/* 소셜 가입 버튼 */}
        <div className="space-y-3">
          <button
            onClick={() => handleSignUp('kakao')}
            disabled={!!loading || !allRequired}
            className="w-full h-[48px] rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#FEE500', color: '#191919' }}
          >
            {loading === 'kakao'
              ? <span className="w-5 h-5 border-2 border-yellow-400 border-t-yellow-700 rounded-full animate-spin" />
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.48 3 2 6.73 2 11.35c0 2.99 1.87 5.62 4.69 7.13l-1.2 4.41 5.13-3.4c.45.06.91.09 1.38.09 5.52 0 10-3.73 10-8.32C22 6.73 17.52 3 12 3z"/></svg>
            }
            카카오로 가입하기
          </button>

          <button
            onClick={() => handleSignUp('google')}
            disabled={!!loading || !allRequired}
            className="w-full h-[48px] rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all border border-brand bg-card text-fore-brand hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            {loading === 'google'
              ? <span className="w-5 h-5 border-2 border-brand border-t-muted-brand rounded-full animate-spin" />
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
            }
            Google로 가입하기
          </button>
        </div>

        {!allRequired && (
          <p className="text-[11px] text-muted2-brand text-center mt-3">필수 약관에 동의하면 가입 버튼이 활성화됩니다.</p>
        )}

        <div className="flex flex-col gap-2 mt-5 text-center">
          <Link href="/login" className="text-accent text-[13px] no-underline font-medium">이미 계정이 있으신가요? 로그인</Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  )
}
