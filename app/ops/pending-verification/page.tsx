import { redirect } from 'next/navigation'

// 이 경로는 ops layout 내부이므로 실제 안내 페이지로 리다이렉트
export default function OpsBlockedRedirect() {
  redirect('/company-pending-verification')
}
