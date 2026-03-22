import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { logAccess } from '@/lib/identity/identity-document-service'
import { decrypt } from '@/lib/security/encryption'

const ORIGINAL_ROLES = ['SUPER_ADMIN', 'ADMIN']

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  )
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canSeeOriginal = ORIGINAL_ROLES.includes(session.role ?? '')
  const { searchParams } = new URL(req.url)
  const documentId = searchParams.get('documentId')
  const ipAddress  = getClientIp(req)

  if (documentId) {
    const doc = await prisma.workerIdentityDocument.findUnique({
      where: { id: documentId }, include: { sensitiveData: true },
    })
    if (!doc || doc.workerId !== params.id) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 })
    }

    await logAccess({
      workerId: params.id, documentId,
      actionType: canSeeOriginal ? 'VIEW_ORIGINAL' : 'VIEW_MASKED',
      actorUserId: session.sub, actorRole: session.role ?? '',
      ipAddress: ipAddress ?? undefined,
    })

    const s = doc.sensitiveData
    return NextResponse.json({
      id: doc.id, documentType: doc.documentType, scanStatus: doc.scanStatus, reviewStatus: doc.reviewStatus,
      fileMimeType: doc.fileMimeType, fileSize: doc.fileSize, uploadedBy: doc.uploadedBy,
      reviewedBy: doc.reviewedBy, reviewedAt: doc.reviewedAt, rejectedReason: doc.rejectedReason,
      isLatest: doc.isLatest, createdAt: doc.createdAt, parsedJson: doc.parsedJson,
      originalUrl: canSeeOriginal ? `/api/admin/identity-documents/${documentId}/file?variant=original` : null,
      maskedUrl: doc.maskedFileKey ? `/api/admin/identity-documents/${documentId}/file?variant=masked` : null,
      sensitive: s ? {
        legalName: s.legalName, birthDate: s.birthDate, nationality: s.nationality,
        residentType: s.residentType, foreignerYn: s.foreignerYn,
        issueDate: s.issueDate, expiryDate: s.expiryDate, verificationStatus: s.verificationStatus,
        idNumberMasked: s.idNumberMasked, addressMasked: s.addressMasked, licenseNumberMasked: s.licenseNumberMasked,
        idNumberFull: canSeeOriginal && s.idNumberEncrypted ? (() => { try { return decrypt(s.idNumberEncrypted!) } catch { return null } })() : null,
        addressFull: canSeeOriginal && s.addressEncrypted ? (() => { try { return decrypt(s.addressEncrypted!) } catch { return null } })() : null,
      } : null,
    })
  }

  const docs = await prisma.workerIdentityDocument.findMany({
    where: { workerId: params.id }, orderBy: { createdAt: 'desc' },
    select: {
      id: true, documentType: true, scanStatus: true, reviewStatus: true,
      isLatest: true, createdAt: true, fileSize: true, uploadedBy: true,
    },
  })
  return NextResponse.json({ items: docs, total: docs.length })
}
