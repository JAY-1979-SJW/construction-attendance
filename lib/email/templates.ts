// ─── 이메일 HTML 템플릿 ────────────────────────────────────────────────────────

const BRAND = process.env.NEXT_PUBLIC_APP_NAME ?? '현장출근관리'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://localhost:3000'

function layout(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; }
    .header { background: #1a56db; padding: 24px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 700; }
    .body { padding: 32px; color: #1f2937; font-size: 15px; line-height: 1.7; }
    .body h2 { font-size: 18px; color: #111827; margin-top: 0; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px 20px; margin: 20px 0; font-size: 14px; }
    .info-box p { margin: 4px 0; }
    .info-box strong { color: #374151; }
    .highlight { color: #1a56db; font-weight: 700; }
    .btn { display: inline-block; background: #1a56db; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 16px; }
    .footer { padding: 20px 32px; background: #f9fafb; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>${BRAND}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">본 메일은 자동 발송된 메일입니다. 문의 사항이 있으시면 담당자에게 연락하세요.</div>
  </div>
</body>
</html>`.trim()
}

// ─── 근로자 회원가입 승인 ──────────────────────────────────────────────────────

export function workerApprovedEmail(params: { name: string }): { subject: string; html: string; text: string } {
  const subject = `[${BRAND}] 회원가입이 승인되었습니다`
  const html = layout(subject, `
    <h2>회원가입 승인 안내</h2>
    <p>안녕하세요, <strong>${params.name}</strong>님.</p>
    <p>회원가입 신청이 <span class="highlight">승인</span>되었습니다.<br/>
    앱에서 로그인 후 현장 출퇴근 서비스를 이용하실 수 있습니다.</p>
    <p>로그인 시 가입 시 사용한 휴대폰 번호를 입력하세요.</p>
    <div class="info-box">
      <p><strong>서비스 이용 방법</strong></p>
      <p>1. 앱에서 휴대폰 번호로 로그인</p>
      <p>2. 현장 참여 신청 후 관리자 승인 대기</p>
      <p>3. 승인 완료 후 출퇴근 기록 시작</p>
    </div>
  `)
  const text = `[${BRAND}] 회원가입 승인 안내\n\n${params.name}님의 회원가입이 승인되었습니다. 앱에서 로그인 후 이용하세요.`
  return { subject, html, text }
}

// ─── 근로자 회원가입 반려 ──────────────────────────────────────────────────────

export function workerRejectedEmail(params: { name: string; rejectReason: string }): { subject: string; html: string; text: string } {
  const subject = `[${BRAND}] 회원가입 신청이 반려되었습니다`
  const html = layout(subject, `
    <h2>회원가입 반려 안내</h2>
    <p>안녕하세요, <strong>${params.name}</strong>님.</p>
    <p>회원가입 신청이 <strong style="color:#dc2626">반려</strong>되었습니다.</p>
    <div class="info-box">
      <p><strong>반려 사유</strong></p>
      <p>${params.rejectReason}</p>
    </div>
    <p>사유를 확인 후 재신청하거나 담당 관리자에게 문의하세요.</p>
  `)
  const text = `[${BRAND}] 회원가입 반려 안내\n\n${params.name}님의 회원가입이 반려되었습니다.\n반려 사유: ${params.rejectReason}`
  return { subject, html, text }
}

// ─── 업체 관리자 신청 승인 ────────────────────────────────────────────────────

export function companyAdminApprovedEmail(params: {
  applicantName: string
  companyName: string
  temporaryPassword: string
  loginUrl?: string
}): { subject: string; html: string; text: string } {
  const loginUrl = params.loginUrl ?? `${BASE_URL}/admin/login`
  const subject = `[${BRAND}] 업체 관리자 신청이 승인되었습니다`
  const html = layout(subject, `
    <h2>업체 관리자 승인 안내</h2>
    <p>안녕하세요, <strong>${params.applicantName}</strong>님.</p>
    <p><strong>${params.companyName}</strong>의 관리자 신청이 <span class="highlight">승인</span>되었습니다.<br/>
    아래 임시 비밀번호로 로그인 후 즉시 비밀번호를 변경해 주세요.</p>
    <div class="info-box">
      <p><strong>로그인 정보</strong></p>
      <p>이메일(아이디): <strong>${params.applicantName} 님의 신청 이메일</strong></p>
      <p>임시 비밀번호: <strong class="highlight">${params.temporaryPassword}</strong></p>
    </div>
    <a href="${loginUrl}" class="btn">관리자 포털 로그인</a>
    <div class="warning">
      ⚠️ 임시 비밀번호는 최초 로그인 후 즉시 변경하세요. 타인에게 공유하지 마세요.
    </div>
  `)
  const text = `[${BRAND}] 업체 관리자 승인 안내\n\n${params.applicantName}님의 ${params.companyName} 관리자 신청이 승인되었습니다.\n임시 비밀번호: ${params.temporaryPassword}\n로그인: ${loginUrl}\n\n임시 비밀번호는 즉시 변경하세요.`
  return { subject, html, text }
}

// ─── 업체 관리자 신청 반려 ────────────────────────────────────────────────────

export function companyAdminRejectedEmail(params: {
  applicantName: string
  companyName: string
  rejectReason: string
}): { subject: string; html: string; text: string } {
  const subject = `[${BRAND}] 업체 관리자 신청이 반려되었습니다`
  const html = layout(subject, `
    <h2>업체 관리자 신청 반려 안내</h2>
    <p>안녕하세요, <strong>${params.applicantName}</strong>님.</p>
    <p><strong>${params.companyName}</strong>의 관리자 신청이 <strong style="color:#dc2626">반려</strong>되었습니다.</p>
    <div class="info-box">
      <p><strong>반려 사유</strong></p>
      <p>${params.rejectReason}</p>
    </div>
    <p>사유를 확인 후 재신청하거나 담당자에게 문의하세요.</p>
  `)
  const text = `[${BRAND}] 업체 관리자 신청 반려 안내\n\n${params.applicantName}님의 ${params.companyName} 관리자 신청이 반려되었습니다.\n반려 사유: ${params.rejectReason}`
  return { subject, html, text }
}

// ─── 현장 참여 신청 승인 ──────────────────────────────────────────────────────

export function siteJoinApprovedEmail(params: {
  workerName: string
  siteName: string
}): { subject: string; html: string; text: string } {
  const subject = `[${BRAND}] 현장 참여 신청이 승인되었습니다`
  const html = layout(subject, `
    <h2>현장 참여 승인 안내</h2>
    <p>안녕하세요, <strong>${params.workerName}</strong>님.</p>
    <p><strong>${params.siteName}</strong> 현장 참여 신청이 <span class="highlight">승인</span>되었습니다.<br/>
    이제 해당 현장에서 출퇴근 기록을 시작할 수 있습니다.</p>
  `)
  const text = `[${BRAND}] 현장 참여 승인 안내\n\n${params.workerName}님의 ${params.siteName} 현장 참여 신청이 승인되었습니다.`
  return { subject, html, text }
}

// ─── 근로자 회원가입 접수 확인 ────────────────────────────────────────────────

export function workerRegisteredEmail(params: { name: string }): { subject: string; html: string; text: string } {
  const subject = `[${BRAND}] 회원가입 신청이 접수되었습니다`
  const html = layout(subject, `
    <h2>회원가입 신청 접수 안내</h2>
    <p>안녕하세요, <strong>${params.name}</strong>님.</p>
    <p>회원가입 신청이 접수되었습니다.<br/>
    담당 관리자 검토 후 승인 또는 반려 결과를 이메일로 알려드리겠습니다.</p>
    <div class="info-box">
      <p><strong>다음 단계</strong></p>
      <p>1. 관리자 검토 (1~2 영업일 내)</p>
      <p>2. 승인 완료 후 이메일 수신</p>
      <p>3. 앱에서 로그인 → 현장 참여 신청</p>
    </div>
  `)
  const text = `[${BRAND}] 회원가입 신청 접수\n\n${params.name}님의 회원가입 신청이 접수되었습니다. 관리자 검토 후 결과를 이메일로 안내해 드립니다.`
  return { subject, html, text }
}

// ─── 업체 관리자 신청 접수 확인 ───────────────────────────────────────────────

export function companyAdminRequestedEmail(params: {
  applicantName: string
  companyName: string
}): { subject: string; html: string; text: string } {
  const subject = `[${BRAND}] 업체 관리자 신청이 접수되었습니다`
  const html = layout(subject, `
    <h2>업체 관리자 신청 접수 안내</h2>
    <p>안녕하세요, <strong>${params.applicantName}</strong>님.</p>
    <p><strong>${params.companyName}</strong>의 관리자 신청이 접수되었습니다.<br/>
    담당자 검토 후 승인 또는 반려 결과를 이메일로 알려드리겠습니다.</p>
    <div class="info-box">
      <p><strong>신청 내용</strong></p>
      <p>업체명: ${params.companyName}</p>
      <p>담당자명: ${params.applicantName}</p>
    </div>
    <div class="warning">
      ⚠️ 사업자등록증 등 추가 서류 제출이 필요할 수 있습니다. 담당자 연락 시 안내에 따라 주세요.
    </div>
  `)
  const text = `[${BRAND}] 업체 관리자 신청 접수\n\n${params.applicantName}님의 ${params.companyName} 관리자 신청이 접수되었습니다. 검토 후 결과를 이메일로 안내드립니다.`
  return { subject, html, text }
}

// ─── 현장 참여 신청 반려 ──────────────────────────────────────────────────────

export function siteJoinRejectedEmail(params: {
  workerName: string
  siteName: string
  rejectReason: string
}): { subject: string; html: string; text: string } {
  const subject = `[${BRAND}] 현장 참여 신청이 반려되었습니다`
  const html = layout(subject, `
    <h2>현장 참여 반려 안내</h2>
    <p>안녕하세요, <strong>${params.workerName}</strong>님.</p>
    <p><strong>${params.siteName}</strong> 현장 참여 신청이 <strong style="color:#dc2626">반려</strong>되었습니다.</p>
    <div class="info-box">
      <p><strong>반려 사유</strong></p>
      <p>${params.rejectReason}</p>
    </div>
  `)
  const text = `[${BRAND}] 현장 참여 반려 안내\n\n${params.workerName}님의 ${params.siteName} 현장 참여 신청이 반려되었습니다.\n반려 사유: ${params.rejectReason}`
  return { subject, html, text }
}
