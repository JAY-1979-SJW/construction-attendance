'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import PublicChatWidget from '@/components/PublicChatWidget'

// ─── 섹션 정의 ──────────────────────────────────────────────

type Section = 'install' | 'register' | 'approve' | 'checkin' | 'checkout' | 'daily' | 'docs' | 'preview' | 'faq'

const SECTIONS: { key: Section; label: string; icon: string; desc: string }[] = [
  { key: 'install',  icon: '📱', label: '1. 앱 설치',      desc: '홈 화면에 추가' },
  { key: 'register', icon: '✍️', label: '2. 회원가입',      desc: '이메일/소셜 가입' },
  { key: 'approve',  icon: '⏳', label: '3. 기기 승인',     desc: '최초 1회' },
  { key: 'checkin',  icon: '🏗️', label: '4. 출근하기',      desc: 'GPS 출근' },
  { key: 'checkout', icon: '🏠', label: '5. 퇴근하기',      desc: 'GPS 퇴근' },
  { key: 'daily',    icon: '📋', label: '6. 작업일보',      desc: '일일 작업 기록' },
  { key: 'docs',     icon: '📄', label: '7. 서류 제출',     desc: '계약서·안전교육' },
  { key: 'preview',  icon: '🖥️', label: '화면 미리보기',    desc: '관리자 화면' },
  { key: 'faq',      icon: '❓', label: '자주 묻는 질문',    desc: 'FAQ' },
]

export default function GuidePage() {
  const [section, setSection] = useState<Section>('install')

  const currentIdx = SECTIONS.findIndex((s) => s.key === section)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < SECTIONS.length - 1

  const prev = () => canPrev && setSection(SECTIONS[currentIdx - 1].key)
  const next = () => canNext && setSection(SECTIONS[currentIdx + 1].key)

  return (
    <div className="font-sans text-fore-brand min-h-screen bg-brand">

      {/* 상단 헤더 */}
      <header className="flex justify-between items-center px-6 h-[60px] bg-card border-b border-brand sticky top-0 z-10 shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
        <Link href="/" className="text-sm text-muted-brand no-underline flex items-center gap-1">
          ← 돌아가기
        </Link>
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo/logo_main.png"
            alt="해한Ai Engineering"
            width={80}
            height={60}
            className="h-10 w-auto rounded-md"
            priority
          />
          <span className="text-brand-muted2 text-[13px]">|</span>
          <span className="text-base font-bold text-fore-brand">사용 가이드</span>
        </div>
        <Link href="/login"
          className="py-[9px] px-5 bg-brand-accent text-white rounded-lg no-underline text-[13px] font-bold shadow-[0_2px_8px_rgba(244,121,32,0.3)]">
          시작하기
        </Link>
      </header>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-7 p-5 lg:p-7 px-4 lg:px-6 max-w-[1200px] mx-auto">

        {/* 스텝 탭 — 모바일: 가로 스크롤 / 데스크탑: 세로 사이드바 */}
        <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 lg:min-w-[200px] lg:flex-none shrink-0">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className="rounded-xl px-4 py-3 cursor-pointer text-left transition-all duration-150 whitespace-nowrap lg:whitespace-normal shrink-0"
              style={
                s.key === section
                  ? { background: 'rgba(244,121,32,0.1)', border: '1px solid #F47920', borderLeft: '3px solid #F47920' }
                  : { background: '#F9FAFB', border: '1px solid #E5E7EB' }
              }
            >
              <span className="block text-[13px] font-bold text-fore-brand mb-0.5">{s.icon} {s.label}</span>
              <span className="block text-[11px] text-brand-muted2">{s.desc}</span>
            </button>
          ))}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 flex flex-col items-center gap-5">
          <div className="w-full max-w-[600px]">
            <SectionContent section={section} onNext={next} />
          </div>

          {/* 이전/다음 버튼 */}
          <div className="flex items-center gap-4">
            <button
              onClick={prev}
              disabled={!canPrev}
              style={{ opacity: canPrev ? 1 : 0.3 }}
              className="py-2.5 px-6 bg-brand-accent text-white border-none rounded-[10px] cursor-pointer text-sm font-bold shadow-[0_3px_10px_rgba(244,121,32,0.3)]"
            >
              ← 이전
            </button>
            <span className="text-sm text-brand-muted2 min-w-12 text-center">
              {currentIdx + 1} / {SECTIONS.length}
            </span>
            <button
              onClick={next}
              disabled={!canNext}
              style={{ opacity: canNext ? 1 : 0.3 }}
              className="py-2.5 px-6 bg-brand-accent text-white border-none rounded-[10px] cursor-pointer text-sm font-bold shadow-[0_3px_10px_rgba(244,121,32,0.3)]"
            >
              다음 →
            </button>
          </div>
        </div>
      </div>

      {/* 하단 CTA */}
      <div className="text-center py-12 px-6 bg-brand-dark">
        <p className="text-muted-brand mb-5 text-base">직접 사용해 보려면?</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/register"
            className="inline-block py-4 px-11 bg-brand-accent text-white rounded-xl no-underline text-[17px] font-bold shadow-[0_4px_16px_rgba(244,121,32,0.4)]">
            회원가입
          </Link>
          <Link href="/login"
            className="inline-block py-4 px-11 bg-card text-fore-brand rounded-xl no-underline text-[17px] font-bold border border-brand">
            로그인
          </Link>
        </div>
      </div>
      <PublicChatWidget />
    </div>
  )
}

/* ──────────────────────────────────────────────
   섹션별 콘텐츠
────────────────────────────────────────────── */

function SectionContent({ section, onNext }: { section: Section; onNext: () => void }) {
  switch (section) {

    // ── 1. 앱 설치 ──────────────────────────────
    case 'install':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">앱 설치 (홈 화면에 추가)</h2>
          <p className="text-sm text-muted-brand">별도 앱스토어 설치 없이, 브라우저에서 홈 화면에 추가하면 앱처럼 사용할 수 있습니다.</p>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-5">
            <div>
              <div className="text-xs font-bold text-accent uppercase tracking-wider mb-3">iPhone (Safari)</div>
              <div className="flex flex-col gap-3">
                {[
                  'Safari에서 attendance.haehan-ai.kr 접속',
                  '하단 공유 버튼 (↑) 탭',
                  '"홈 화면에 추가" 선택',
                  '"추가" 탭 → 완료',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-accent text-white text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-[13px] text-body-brand">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-brand pt-4">
              <div className="text-xs font-bold text-accent uppercase tracking-wider mb-3">Android (Chrome)</div>
              <div className="flex flex-col gap-3">
                {[
                  'Chrome에서 attendance.haehan-ai.kr 접속',
                  '우측 상단 ⋮ 메뉴 탭',
                  '"홈 화면에 추가" 또는 "앱 설치" 선택',
                  '"설치" 탭 → 완료',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-accent text-white text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-[13px] text-body-brand">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[rgba(91,164,217,0.08)] border border-brand rounded-xl p-4 text-xs text-secondary-brand">
            관리자가 카톡으로 보낸 초대 링크를 열면 이 페이지로 바로 이동합니다.
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 회원가입 →
          </button>
        </div>
      )

    // ── 2. 회원가입 ─────────────────────────────
    case 'register':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">회원가입</h2>
          <p className="text-sm text-muted-brand">이메일/비밀번호 또는 Google/카카오로 가입합니다.</p>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-4">
            <div className="text-xs font-bold text-accent uppercase tracking-wider mb-3">방법 1: 이메일 가입</div>
            <div className="flex flex-col gap-3">
              <StepCard step={1} title="가입 유형 선택" desc="회원가입 페이지에서 '이메일 가입'을 선택합니다." />
              <StepCard step={2} title="정보 입력" desc={<>이메일, 비밀번호, <strong>실명</strong>, 직종을 입력합니다.</>} />
              <StepCard step={3} title="약관 동의" desc="서비스 이용약관, 개인정보 수집·이용에 동의합니다." />
              <StepCard step={4} title="승인 대기" desc="관리자 승인 후 사용 가능합니다." />
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-4">
            <div className="text-xs font-bold text-accent uppercase tracking-wider mb-3">방법 2: 소셜 가입 (Google/카카오)</div>
            <div className="flex flex-col gap-3">
              <StepCard step={1} title="약관 동의" desc="서비스 이용약관, 개인정보 처리방침에 동의합니다." />
              <StepCard step={2} title="소셜 인증" desc="Google 또는 카카오 버튼으로 본인 인증합니다." />
              <StepCard step={3} title="정보 입력" desc="이름, 전화번호, 직종을 추가 입력합니다." />
              <StepCard step={4} title="승인 대기" desc="관리자 승인 후 사용 가능합니다." />
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-3">
            <div className="text-xs font-bold text-[#16A34A] uppercase tracking-wider mb-2">사업자 (업체 관리자) 가입</div>
            <p className="text-[13px] text-muted-brand m-0">사업자등록번호를 가진 업체 관리자는 별도 양식으로 가입 신청합니다.</p>
            <p className="text-[13px] text-muted-brand m-0">가입 승인 후 이메일/비밀번호가 발급됩니다.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
            <p className="font-bold m-0">주의사항</p>
            <p className="m-0">- 이름은 반드시 <strong>실명</strong>으로 입력하세요 (급여·보험 신고에 사용)</p>
            <p className="m-0">- 생년월일은 <strong>YYYYMMDD</strong> 형식 (예: 19850315)</p>
            <p className="m-0">- 전화번호는 본인 번호만 가능 (기기 인증에 사용)</p>
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 기기 승인 →
          </button>
        </div>
      )

    // ── 3. 기기 승인 ────────────────────────────
    case 'approve':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">기기 승인 (최초 1회)</h2>
          <p className="text-sm text-muted-brand">가입 후 처음 로그인하면 "기기 승인 대기" 화면이 나타납니다. 현장 관리자가 승인하면 자동으로 앱을 사용할 수 있습니다.</p>

          <div className="bg-card rounded-2xl p-6 border border-brand text-center space-y-4">
            <div className="text-[48px]">⏳</div>
            <div className="text-lg font-bold text-fore-brand">기기 승인 대기 중</div>
            <div className="text-[13px] text-muted-brand leading-[1.7]">
              현장 관리자가 이 기기를 승인하면<br />자동으로 사용 가능합니다.
            </div>
            <div className="bg-[rgba(91,164,217,0.1)] rounded-[10px] py-3 px-4 text-[13px] text-secondary-brand">
              승인 완료 후 다시 로그인하세요
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-3">
            <div className="text-sm font-bold text-fore-brand">승인이 안 되면?</div>
            <ul className="text-[13px] text-muted-brand space-y-2 list-none p-0 m-0">
              <li>- 현장 관리자에게 직접 연락하세요</li>
              <li>- 관리자가 <strong>관리자 포털 → 기기 승인</strong>에서 승인합니다</li>
              <li>- 기기 변경 시에도 관리자 재승인이 필요합니다</li>
            </ul>
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 출근하기 →
          </button>
        </div>
      )

    // ── 4. 출근 ─────────────────────────────────
    case 'checkin':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">출근하기</h2>
          <p className="text-sm text-muted-brand">현장에 도착하면 GPS 위치 기반으로 출근 처리합니다.</p>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-4">
            <div className="flex flex-col gap-4">
              <StepCard step={1} title="앱 열기" desc="홈 화면에서 앱을 실행합니다." />
              <StepCard step={2} title="출근 버튼 클릭" desc="현장 근처(100m 이내)에서 '출근' 버튼을 누릅니다." />
              <StepCard step={3} title="위치 권한 허용" desc="브라우저에서 위치 권한을 요청하면 '허용'을 누릅니다." />
              <StepCard step={4} title="출근 완료" desc="GPS 확인 후 출근이 자동 기록됩니다." />
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-3">
            <div className="text-sm font-bold text-fore-brand">출근이 안 되면?</div>
            <ul className="text-[13px] text-muted-brand space-y-2 list-none p-0 m-0">
              <li>- <strong>GPS가 꺼져있으면</strong>: 설정에서 위치 서비스를 켜세요</li>
              <li>- <strong>현장에서 너무 멀면</strong>: 현장 100m 이내로 이동하세요</li>
              <li>- <strong>그래도 안 되면</strong>: "GPS 예외 신청" 버튼을 눌러 관리자에게 요청하세요</li>
            </ul>
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 퇴근하기 →
          </button>
        </div>
      )

    // ── 5. 퇴근 ─────────────────────────────────
    case 'checkout':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">퇴근하기</h2>
          <p className="text-sm text-muted-brand">작업이 끝나면 출근과 동일한 방식으로 퇴근 처리합니다.</p>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-4">
            <div className="flex flex-col gap-4">
              <StepCard step={1} title="앱 열기" desc="홈 화면에서 앱을 실행합니다." />
              <StepCard step={2} title="퇴근 버튼 클릭" desc="현장 근처에서 '퇴근' 버튼을 누릅니다." />
              <StepCard step={3} title="퇴근 완료" desc="오늘의 근무 시간이 자동 계산됩니다." />
            </div>
          </div>

          <div className="bg-green-light rounded-xl p-4 text-sm text-[#2e7d32]">
            퇴근을 잊었을 경우 새벽 4시에 자동 퇴근 처리됩니다. 단, 근무 시간이 정확하지 않을 수 있으니 꼭 직접 퇴근 처리해 주세요.
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 작업일보 →
          </button>
        </div>
      )

    // ── 6. 작업일보 ─────────────────────────────
    case 'daily':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">작업일보 작성</h2>
          <p className="text-sm text-muted-brand">매일 퇴근 전/후에 오늘 한 작업을 기록합니다.</p>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-4">
            <div className="text-xs font-bold text-muted2-brand uppercase tracking-wider mb-1">작성 항목</div>
            <div className="flex flex-col gap-3">
              {[
                { label: '공종/작업', desc: '전기 → 배관 → 지하1층 배관 설치' },
                { label: '작업 위치', desc: '동/층/상세 위치' },
                { label: '오늘 작업 내용', desc: '구체적인 작업 내용 기록' },
                { label: '작업 시간', desc: '시작~종료 시간' },
                { label: '공수', desc: '오늘 투입 공수 (기본 1.0)' },
                { label: '사진', desc: '작업 현장 사진 (최대 3장)' },
                { label: '특이사항', desc: '메모, 안전 이슈 등' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                  <div>
                    <span className="text-[13px] font-bold text-fore-brand">{item.label}</span>
                    <span className="text-[12px] text-muted-brand ml-2">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[rgba(91,164,217,0.08)] border border-brand rounded-xl p-4 text-xs text-secondary-brand space-y-1">
            <p className="font-bold m-0">편의 기능</p>
            <p className="m-0">- 전날 작업 내용을 자동으로 불러와 수정할 수 있습니다</p>
            <p className="m-0">- 자주 하는 작업이 추천 목록으로 표시됩니다</p>
            <p className="m-0">- 내일 작업 예정도 미리 입력해둘 수 있습니다</p>
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 서류 제출 →
          </button>
        </div>
      )

    // ── 7. 서류 제출 ────────────────────────────
    case 'docs':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">서류 제출</h2>
          <p className="text-sm text-muted-brand">현장 투입 전 필요한 서류를 모바일에서 제출합니다.</p>

          <div className="bg-card rounded-2xl p-5 border border-brand space-y-4">
            <div className="text-xs font-bold text-muted2-brand uppercase tracking-wider mb-1">제출 서류 예시</div>
            <div className="flex flex-col gap-3">
              {[
                { icon: '📝', label: '근로계약서', desc: '전자 서명으로 간편 체결' },
                { icon: '🛡️', label: '안전교육 확인서', desc: '안전교육 수료 후 확인' },
                { icon: '🏥', label: '건강진단서', desc: '건강진단 결과 사진 업로드' },
                { icon: '📋', label: '개인정보 동의서', desc: '모바일에서 서명 후 제출' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center text-[18px] shrink-0">{item.icon}</span>
                  <div>
                    <div className="text-[13px] font-bold text-fore-brand">{item.label}</div>
                    <div className="text-[11px] text-muted-brand">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-brand">
            <div className="text-sm font-bold text-fore-brand mb-2">제출 방법</div>
            <div className="flex flex-col gap-3">
              <StepCard step={1} title="앱 → 내 서류" desc="하단 메뉴에서 '서류 제출' 메뉴를 선택합니다." />
              <StepCard step={2} title="미제출 서류 확인" desc="빨간색 '미제출' 표시된 서류를 탭합니다." />
              <StepCard step={3} title="서명 또는 업로드" desc="전자 서명을 하거나, 서류 사진을 업로드합니다." />
              <StepCard step={4} title="제출 완료" desc="관리자가 확인하면 상태가 '확인완료'로 변경됩니다." />
            </div>
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 자주 묻는 질문 →
          </button>
        </div>
      )

    // ── 화면 미리보기 ─────────────────────────────
    case 'preview':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">관리자 화면 미리보기</h2>
          <p className="text-sm text-muted-brand">가입 전에 관리자 포털의 주요 화면을 확인해 보세요.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { src: '/guide/01-_admin.png', label: '대시보드' },
              { src: '/guide/06-_admin_attendance.png', label: '출퇴근 관리' },
              { src: '/guide/02-_admin_sites.png', label: '현장 관리' },
              { src: '/guide/07-_admin_work-confirmations.png', label: '공수 확인' },
              { src: '/guide/12-_admin_contracts.png', label: '근로계약서' },
              { src: '/guide/08-_admin_wage.png', label: '노임 관리' },
              { src: '/guide/09-_admin_insurance-eligibility.png', label: '보험 자격 판정' },
              { src: '/guide/11-_admin_materials_requests.png', label: '자재 관리' },
            ].map(item => (
              <div key={item.label} className="bg-card rounded-xl border border-brand overflow-hidden">
                <img src={item.src} alt={item.label} className="w-full h-auto" loading="lazy" />
                <div className="px-3 py-2 text-[13px] font-semibold text-fore-brand border-t border-brand">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-accent-light border border-accent-pale rounded-xl p-4 text-center">
            <div className="text-sm font-bold text-accent mb-2">직접 사용해 보고 싶다면?</div>
            <div className="flex gap-3 justify-center flex-wrap mt-3">
              <a href="/register" className="inline-block py-2.5 px-6 bg-brand-accent text-white rounded-lg no-underline text-[14px] font-bold">무료 가입하기</a>
              <a href="/login" className="inline-block py-2.5 px-6 border border-brand text-body-brand rounded-lg no-underline text-[14px]">로그인</a>
            </div>
          </div>

          <button onClick={onNext} className="w-full py-3 text-sm bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[10px] cursor-pointer font-semibold">
            다음: 자주 묻는 질문 →
          </button>
        </div>
      )

    // ── FAQ ──────────────────────────────────────
    case 'faq':
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-fore-brand">자주 묻는 질문</h2>

          <div className="space-y-3">
            {[
              {
                q: '앱스토어에서 앱을 못 찾겠어요',
                a: '별도 앱스토어 다운로드가 아닙니다. 브라우저에서 attendance.haehan-ai.kr 접속 후 "홈 화면에 추가"를 해주세요.',
              },
              {
                q: '기기 승인은 얼마나 걸리나요?',
                a: '관리자가 승인하면 바로 사용 가능합니다. 보통 당일 내 처리됩니다.',
              },
              {
                q: '출근 버튼이 안 눌려요',
                a: '① 위치 서비스가 켜져있는지 확인 ② 현장 100m 이내인지 확인 ③ 안 되면 "GPS 예외 신청" 버튼을 이용해주세요.',
              },
              {
                q: '퇴근을 깜빡했어요',
                a: '새벽 4시에 자동 퇴근 처리됩니다. 다만 정확한 시간 기록을 위해 직접 퇴근 처리를 권장합니다.',
              },
              {
                q: '휴대폰을 바꿨어요',
                a: '새 휴대폰에서 로그인하면 "기기 변경 요청"이 관리자에게 전달됩니다. 승인 후 사용 가능합니다.',
              },
              {
                q: '작업일보를 수정하고 싶어요',
                a: '당일 내에는 같은 화면에서 수정 후 저장하면 됩니다. 관리자 확정 전까지 수정 가능합니다.',
              },
              {
                q: '내 출퇴근 기록을 보고 싶어요',
                a: '앱 홈 화면에서 "내 출퇴근 현황 보기"를 눌러 이력을 확인할 수 있습니다.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-card rounded-xl p-4 border border-brand">
                <div className="text-[14px] font-bold text-fore-brand mb-2">Q. {q}</div>
                <div className="text-[13px] text-muted-brand leading-[1.7]">{a}</div>
              </div>
            ))}
          </div>

          <div className="bg-brand-accent/10 border border-accent rounded-xl p-5 text-center">
            <div className="text-sm font-bold text-accent mb-2">더 궁금한 점이 있으면?</div>
            <div className="text-[13px] text-muted-brand mb-3">현장 관리자 또는 회사 담당자에게 문의해 주세요.</div>
            <div className="text-[13px] text-fore-brand">
              전화: <strong>02-562-6652</strong> &nbsp;|&nbsp; 이메일: <strong>jay@haehan-ai.kr</strong>
            </div>
          </div>
        </div>
      )
  }
}

/* ── 재사용 컴포넌트 ─────────────────────────── */

function StepCard({ step, title, desc }: { step: number; title: string; desc: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-brand-accent text-white text-[13px] font-bold flex items-center justify-center shrink-0">{step}</span>
      <div>
        <div className="text-[14px] font-bold text-fore-brand">{title}</div>
        <div className="text-[12px] text-muted-brand leading-[1.6] mt-0.5">{desc}</div>
      </div>
    </div>
  )
}
