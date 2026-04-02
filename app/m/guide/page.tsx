'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function MobileGuidePage() {
  return (
    <div className="px-5 py-6 pb-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-bold text-gray-900 m-0">사용 가이드</h1>
        <Link href="/m" className="text-[13px] text-gray-400 no-underline">← 메인</Link>
      </div>

      {/* ── 왜 필요한가 ── */}
      <Section id="why" title="🛡️ 왜 필요한가">
        <Card title="안전한 현장 운영" tag="산업안전보건법">
          중대재해처벌법이 전 사업장으로 확대되었습니다. 누가, 언제, 어디서 작업했는지 체계적으로 기록하면 사업주의 안전관리 의무 이행을 증명할 수 있습니다.
        </Card>
        <Card title="투명한 근로 관계" tag="근로기준법">
          근로자는 자신의 출퇴근과 공수를 직접 확인하고, 사업주는 정확한 데이터로 공정하게 정산합니다. 서로 확인할 수 있는 기록이 분쟁을 예방합니다.
        </Card>
        <Card title="정확한 정산과 신고" tag="고용보험법">
          정확한 근무일수로 4대보험과 퇴직공제가 빠짐없이 처리됩니다. 근로자는 보험 혜택을 놓치지 않고, 사업주는 신고 누락 걱정이 없습니다.
        </Card>
      </Section>

      {/* ── 핵심 기능 ── */}
      <Section id="features" title="⚡ 핵심 기능">
        <div className="space-y-2">
          {[
            { icon: '📍', name: 'GPS 출퇴근', desc: '현장 도착 시 버튼 하나로 출근, GPS 자동 확인' },
            { icon: '📋', name: '작업일보', desc: '공종·위치·사진과 함께 일일 작업 기록' },
            { icon: '💰', name: '공수·급여 자동계산', desc: '출퇴근 기반 공수 집계, 급여 자동 산출' },
            { icon: '📄', name: '전자 계약·서명', desc: '근로계약서를 모바일에서 확인하고 서명' },
            { icon: '🛡️', name: '안전교육 확인', desc: '안전교육 확인서, 보호구 지급서 전자서명' },
            { icon: '📊', name: '4대보험 자동집계', desc: '고용보험·산재·퇴직공제 자동 계산' },
            { icon: '📅', name: '근무 캘린더', desc: '월별 출퇴근·공수를 캘린더로 한눈에' },
            { icon: '🔔', name: '체류확인 알림', desc: '현장 재실 여부 푸시 알림 확인' },
            { icon: '📦', name: '자재 청구', desc: '현장에서 바로 자재 요청·승인' },
          ].map(f => (
            <div key={f.name} className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
              <span className="text-[20px] shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <div className="text-[14px] font-bold text-gray-900">{f.name}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 사용 방법 ── */}
      <Section id="flow" title="📱 사용 방법">
        <div className="space-y-3">
          {[
            { n: '1', title: '가입', desc: '이메일 또는 Google/카카오로 간편 가입' },
            { n: '2', title: '현장 배정', desc: '관리자가 현장을 배정하면 알림이 옵니다' },
            { n: '3', title: '출퇴근', desc: '현장 도착 → 출근 버튼, 퇴근 시 퇴근 버튼' },
            { n: '4', title: '작업일보', desc: '하루 작업 내용을 사진과 함께 기록' },
            { n: '5', title: '공수 확인', desc: '캘린더에서 월별 공수와 급여를 확인' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-orange-500 text-white text-[13px] font-bold flex items-center justify-center shrink-0">{s.n}</div>
              <div>
                <div className="text-[14px] font-bold text-gray-900">{s.title}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 수기 vs 전자 ── */}
      <Section id="compare" title="📊 수기 vs 전자">
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-2">
          <div className="text-[14px] font-bold text-orange-700 mb-2">수기 출석부</div>
          {['대리 서명 가능 — 신뢰도 낮음', '분쟁 시 증거로 인정 어려움', '월말 정산 오류 발생'].map(t => (
            <div key={t} className="text-[13px] text-orange-600 mb-1">- {t}</div>
          ))}
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="text-[14px] font-bold text-green-700 mb-2">GPS 전자 출퇴근</div>
          {['GPS+시간 자동 기록 — 객관적 증거', '기기 인증으로 본인만 가능', '공수·급여 자동 계산'].map(t => (
            <div key={t} className="text-[13px] text-green-700 mb-1">+ {t}</div>
          ))}
        </div>
      </Section>

      {/* ── 사용 대상 ── */}
      <Section id="users" title="👥 사용 대상">
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-2">
          <div className="text-[14px] font-bold text-gray-900 mb-2">근로자</div>
          {['GPS 출퇴근 기록', '내 공수·급여 캘린더', '작업일보 작성', '계약서·안전교육 전자서명'].map(t => (
            <div key={t} className="text-[13px] text-gray-600 mb-1">· {t}</div>
          ))}
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-[14px] font-bold text-gray-900 mb-2">사업자 (관리자)</div>
          {['현장별 출근 현황 실시간', '공수·급여 자동 정산', '4대보험·퇴직공제 집계', '노임대장·세금계산표 출력'].map(t => (
            <div key={t} className="text-[13px] text-gray-600 mb-1">· {t}</div>
          ))}
        </div>
      </Section>

      {/* ── 화면 미리보기 ── */}
      <Section id="preview" title="🖥️ 관리자 화면 미리보기">
        <div className="space-y-2">
          {[
            { src: '/guide/01-_admin.png', label: '대시보드' },
            { src: '/guide/06-_admin_attendance.png', label: '출퇴근 관리' },
            { src: '/guide/07-_admin_work-confirmations.png', label: '공수 확인' },
            { src: '/guide/08-_admin_wage.png', label: '노임 관리' },
          ].map(i => (
            <ScreenshotCard key={i.label} src={i.src} label={i.label} />
          ))}
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section id="faq" title="❓ 자주 묻는 질문">
        <div className="space-y-2">
          <FaqItem q="앱스토어에서 못 찾겠어요" a="앱스토어가 아닙니다. 브라우저에서 '홈 화면에 추가'를 해주세요." />
          <FaqItem q="기기 승인이 안 돼요" a="관리자에게 직접 연락하세요. 보통 당일 처리됩니다." />
          <FaqItem q="출근 버튼이 안 눌려요" a="위치 서비스 켜기 → 현장 100m 이내 확인 → 안 되면 '예외 신청'" />
          <FaqItem q="휴대폰을 바꿨어요" a="새 폰에서 로그인하면 기기 변경 요청이 관리자에게 전달됩니다." />
          <FaqItem q="내 공수를 확인하고 싶어요" a="하단 '공수/급여' 탭에서 월별 캘린더로 확인할 수 있습니다." />
        </div>
        <div className="bg-orange-50 rounded-xl p-4 text-center mt-3">
          <p className="text-[13px] font-bold text-orange-600 mb-1 m-0">더 궁금한 점이 있으면?</p>
          <p className="text-[12px] text-gray-600 m-0">02-562-6652 | jay@haehan-ai.kr</p>
        </div>
      </Section>

      {/* 하단 CTA */}
      <div className="mt-8 space-y-2.5">
        <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold text-center active:bg-orange-600">무료 시작하기</Link>
        <Link href="/m/login" className="block w-full py-3 border-2 border-gray-200 bg-white text-gray-700 rounded-2xl no-underline text-[14px] font-semibold text-center active:bg-gray-50">로그인</Link>
      </div>
    </div>
  )
}

// ── 공통 컴포넌트 ──

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-8 scroll-mt-4">
      <h2 className="text-[17px] font-bold text-gray-900 mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Card({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 mb-2">
      <div className="text-[14px] font-bold text-gray-900 mb-1">{title}</div>
      <div className="text-[13px] text-gray-500 leading-[1.7] mb-2">{children}</div>
      <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{tag}</span>
    </div>
  )
}

function ScreenshotCard({ src, label }: { src: string; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 text-left cursor-pointer active:bg-gray-50">
        <span className="text-[18px] shrink-0">📸</span>
        <span className="text-[14px] font-semibold text-gray-900">{label}</span>
        <span className="text-gray-300 text-[14px] shrink-0 ml-auto">›</span>
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-full max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[14px] font-bold text-gray-900">{label}</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 text-[18px] bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="overflow-auto max-h-[75vh]">
              <img src={src} alt={label} className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer text-left active:bg-gray-50">
        <span className="flex-1 text-[14px] font-semibold text-gray-900">{q}</span>
        <span className={`text-gray-400 text-[12px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-4 pb-3 text-[13px] text-gray-500 leading-[1.7]">{a}</div>}
    </div>
  )
}
