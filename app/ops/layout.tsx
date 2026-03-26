import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/db/prisma'
import OpsTopNav from './OpsTopNav'

const ALLOWED_ROLES = ['SITE_ADMIN', 'EXTERNAL_SITE_ADMIN', 'SUPER_ADMIN', 'ADMIN']

async function getSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_token')?.value
    if (!token) return null
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
    const { payload } = await jwtVerify(token, secret)
    return payload as { sub: string; role: string; name: string; companyId?: string }
  } catch {
    return null
  }
}

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    redirect('/admin/login')
  }

  // EXTERNAL_SITE_ADMIN: 소속 회사가 VERIFIED 상태인지 확인
  if (session.role === 'EXTERNAL_SITE_ADMIN') {
    if (!session.companyId) {
      redirect('/company-pending-verification')
    }
    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { externalVerificationStatus: true },
    })
    if (!company || company.externalVerificationStatus !== 'VERIFIED') {
      redirect('/company-pending-verification')
    }
  }

  const isReadOnly = session.role === 'EXTERNAL_SITE_ADMIN'
  const roleLabel = session.role === 'EXTERNAL_SITE_ADMIN'
    ? '지정 현장 운영형'
    : session.role === 'SITE_ADMIN'
      ? '현장 관리자'
      : '내부 운영'

  return (
    <div className="h-screen flex flex-col font-sans bg-[#f5f6f8] overflow-hidden">
      <OpsTopNav
        userName={session.name}
        roleLabel={roleLabel}
        isReadOnly={isReadOnly}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
