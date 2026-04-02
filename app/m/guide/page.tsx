'use client'

import { useState } from 'react'
import Link from 'next/link'

const SECTIONS = [
  { key: 'install', icon: '📱', title: '앱 설치', content: (
    <div className="space-y-3">
      <p className="text-[14px] text-gray-500 m-0">앱스토어 설치 없이 브라우저에서 홈 화면에 추가하세요.</p>
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-[13px] font-bold text-gray-900 mb-2 m-0">iPhone (Safari)</p>
        {['Safari에서 접속', '하단 공유(↑) 탭', '"홈 화면에 추가"', '"추가" 탭'].map((t, i) => <Step key={i} n={i+1} text={t} />)}
      </div>
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-[13px] font-bold text-gray-900 mb-2 m-0">Android (Chrome)</p>
        {['Chrome에서 접속', '⋮ 메뉴 탭', '"홈 화면에 추가" 또는 "앱 설치"', '"설치" 탭'].map((t, i) => <Step key={i} n={i+1} text={t} />)}
      </div>
    </div>
  )},
  { key: 'register', icon: '✍️', title: '회원가입', content: (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-[13px] font-bold text-orange-500 mb-2 m-0">이메일 가입</p>
        {['이메일/비밀번호/이름/직종 입력', '약관 동의', '관리자 승인 대기'].map((t, i) => <Step key={i} n={i+1} text={t} />)}
      </div>
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-[13px] font-bold text-orange-500 mb-2 m-0">소셜 가입 (Google/카카오)</p>
        {['약관 동의', 'Google 또는 카카오 인증', '이름/직종 추가 입력', '관리자 승인 대기'].map((t, i) => <Step key={i} n={i+1} text={t} />)}
      </div>
      <div className="bg-orange-50 rounded-2xl p-4">
        <p className="text-[13px] text-orange-700 m-0">이름은 <strong>실명</strong>, 전화번호는 <strong>본인 번호</strong>만 입력하세요.</p>
      </div>
    </div>
  )},
  { key: 'checkin', icon: '🏗️', title: '출근 / 퇴근', content: (
    <div className="space-y-3">
      {['앱 열기', '현장 100m 이내에서 출근 버튼', '위치 권한 허용', '출근 완료'].map((t, i) => <Step key={i} n={i+1} text={t} />)}
      <div className="bg-gray-100 rounded-2xl p-4 text-[13px] text-gray-600">
        <p className="m-0 mb-1"><strong>퇴근을 깜빡하면?</strong></p>
        <p className="m-0">새벽 4시에 자동 퇴근 처리되지만, 직접 퇴근 처리를 권장합니다.</p>
      </div>
      <div className="bg-gray-100 rounded-2xl p-4 text-[13px] text-gray-600">
        <p className="m-0 mb-1"><strong>GPS가 안 되면?</strong></p>
        <p className="m-0">"GPS 예외 신청" 버튼으로 관리자에게 요청하세요.</p>
      </div>
    </div>
  )},
  { key: 'daily', icon: '📋', title: '작업일보', content: (
    <div className="space-y-2">
      <p className="text-[14px] text-gray-500 m-0">매일 퇴근 전 오늘 한 작업을 기록합니다.</p>
      {['공종/작업 — 전기 → 배관 → 설치', '작업 위치 — 동/층/상세', '오늘 작업 내용', '작업 시간 (시작~종료)', '공수 (기본 1.0)', '사진 (최대 3장)'].map(t => (
        <div key={t} className="flex items-center gap-2 text-[14px] text-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />{t}
        </div>
      ))}
      <div className="bg-blue-50 rounded-2xl p-3 mt-2 text-[13px] text-blue-700">전날 작업을 자동으로 불러와 수정할 수 있습니다.</div>
    </div>
  )},
  { key: 'docs', icon: '📄', title: '서류 제출 / 전자서명', content: (
    <div className="space-y-3">
      {['근로계약서 — 전자서명으로 체결', '안전교육 확인서 — 교육 후 서명', '보호구 지급 확인서 — 수령 확인', '건강 각서 — 모바일 서명'].map(t => (
        <div key={t} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100 text-[14px] text-gray-700">
          <span className="text-[18px]">📝</span>{t}
        </div>
      ))}
      <p className="text-[13px] text-gray-500 m-0">앱 → 서류 탭 → 미제출 서류 선택 → 서명/업로드</p>
    </div>
  )},
  { key: 'preview', icon: '🖥️', title: '관리자 화면 미리보기', content: (
    <div className="grid grid-cols-2 gap-2">
      {[
        { src: '/guide/01-_admin.png', label: '대시보드' },
        { src: '/guide/06-_admin_attendance.png', label: '출퇴근' },
        { src: '/guide/02-_admin_sites.png', label: '현장 관리' },
        { src: '/guide/07-_admin_work-confirmations.png', label: '공수 확인' },
        { src: '/guide/12-_admin_contracts.png', label: '계약서' },
        { src: '/guide/08-_admin_wage.png', label: '노임 관리' },
      ].map(i => (
        <div key={i.label} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <img src={i.src} alt={i.label} className="w-full h-auto" loading="lazy" />
          <div className="px-2.5 py-1.5 text-[12px] font-semibold text-gray-700">{i.label}</div>
        </div>
      ))}
    </div>
  )},
  { key: 'faq', icon: '❓', title: '자주 묻는 질문', content: (
    <div className="space-y-2.5">
      {[
        { q: '앱스토어에서 못 찾겠어요', a: '앱스토어 다운로드가 아닙니다. 브라우저에서 "홈 화면에 추가"를 해주세요.' },
        { q: '기기 승인이 안 돼요', a: '관리자에게 직접 연락하세요. 보통 당일 처리됩니다.' },
        { q: '출근 버튼이 안 눌려요', a: '위치 서비스 켜기 → 현장 100m 이내 확인 → 안 되면 "예외 신청"' },
        { q: '휴대폰을 바꿨어요', a: '새 폰에서 로그인하면 기기 변경 요청이 관리자에게 전달됩니다.' },
        { q: '내 공수를 확인하고 싶어요', a: '앱 하단 "공수/급여" 탭에서 월별 캘린더로 확인할 수 있습니다.' },
      ].map(({ q, a }) => (
        <div key={q} className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-[14px] font-bold text-gray-900 mb-1.5 m-0">Q. {q}</p>
          <p className="text-[13px] text-gray-500 leading-[1.7] m-0">{a}</p>
        </div>
      ))}
      <div className="bg-orange-50 rounded-2xl p-4 text-center mt-3">
        <p className="text-[14px] font-bold text-orange-600 mb-1 m-0">더 궁금한 점이 있으면?</p>
        <p className="text-[13px] text-gray-600 m-0">02-562-6652 | jay@haehan-ai.kr</p>
      </div>
    </div>
  )},
]

export default function MobileGuidePage() {
  const [open, setOpen] = useState<string | null>('install')

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold text-gray-900 m-0">사용 가이드</h1>
        <Link href="/m" className="text-[13px] text-gray-400 no-underline">← 메인</Link>
      </div>

      <div className="space-y-2.5 mb-8">
        {SECTIONS.map(s => (
          <div key={s.key} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
            <button onClick={() => setOpen(open === s.key ? null : s.key)}
              className="w-full flex items-center gap-3 px-4 py-4 bg-transparent border-none cursor-pointer text-left active:bg-gray-100">
              <span className="text-[20px]">{s.icon}</span>
              <span className="flex-1 text-[15px] font-bold text-gray-900">{s.title}</span>
              <span className={`text-gray-400 transition-transform ${open === s.key ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {open === s.key && <div className="px-4 pb-4">{s.content}</div>}
          </div>
        ))}
      </div>

      {/* 하단 CTA */}
      <div className="text-center space-y-2.5">
        <Link href="/m/register" className="block w-full py-4 bg-orange-500 text-white rounded-2xl no-underline text-[16px] font-bold active:bg-orange-600">무료 가입하기</Link>
        <Link href="/m/login" className="block w-full py-3.5 border-2 border-gray-200 bg-white text-gray-700 rounded-2xl no-underline text-[15px] font-semibold active:bg-gray-50">로그인</Link>
      </div>
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-1.5">
      <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-[12px] font-bold flex items-center justify-center shrink-0">{n}</span>
      <span className="text-[14px] text-gray-700">{text}</span>
    </div>
  )
}
