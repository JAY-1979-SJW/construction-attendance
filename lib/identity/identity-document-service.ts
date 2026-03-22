import { prisma } from '@/lib/db/prisma'
import { encrypt, maskIdNumber, maskAddress } from '@/lib/security/encryption'
import { saveOriginalFile, saveMaskedFile, getExtFromMime } from '@/lib/storage/identity-storage'
import { maskIdentityImage } from './image-masking'
import { runOcr, type ParsedIdDocument } from './ocr-service'

interface UploadOptions {
  workerId: string
  buffer: Buffer
  mimeType: string
  uploadedBy: string
  actorRole: string
}

export async function uploadIdentityDocument(opts: UploadOptions) {
  const { workerId, buffer, mimeType, uploadedBy, actorRole } = opts
  const ext = getExtFromMime(mimeType)

  const originalFileKey = await saveOriginalFile(buffer, ext)

  let maskedFileKey: string | null = null
  try {
    const maskedBuffer = await maskIdentityImage(buffer)
    maskedFileKey = await saveMaskedFile(maskedBuffer, '.jpg')
  } catch (e) { console.error('[identity] 마스킹 실패:', e) }

  const parsed = await runOcr(buffer, mimeType)

  await prisma.workerIdentityDocument.updateMany({
    where: { workerId, isLatest: true },
    data: { isLatest: false },
  })

  const doc = await prisma.workerIdentityDocument.create({
    data: {
      workerId,
      documentType: (parsed.documentType ?? 'UNKNOWN') as never,
      originalFileKey,
      maskedFileKey,
      fileMimeType: mimeType,
      fileSize: buffer.length,
      ocrRawText: parsed.rawText ?? null,
      parsedJson: parsed as never,
      scanStatus: (parsed.rawText?.startsWith('[OCR') ? 'FAILED' : 'PARSED') as never,
      reviewStatus: 'PENDING_REVIEW' as never,
      uploadedBy,
      isLatest: true,
    },
  })

  await upsertSensitiveIdentity(workerId, doc.id, parsed)

  await logAccess({ workerId, documentId: doc.id, actionType: 'UPLOAD', actorUserId: uploadedBy, actorRole })
  await logAccess({ workerId, documentId: doc.id, actionType: 'OCR_RUN', actorUserId: uploadedBy, actorRole })

  await prisma.worker.update({
    where: { id: workerId },
    data: { idVerificationStatus: 'PENDING_REVIEW' as never, latestIdentityDocumentId: doc.id },
  })

  return { documentId: doc.id, reviewStatus: 'PENDING_REVIEW', scanStatus: doc.scanStatus, parsed }
}

async function upsertSensitiveIdentity(workerId: string, sourceDocumentId: string, parsed: ParsedIdDocument) {
  const data = {
    workerId,
    sourceDocumentId,
    legalName: parsed.name ?? null,
    birthDate: parsed.birthDate ?? null,
    nationality: parsed.nationality ?? null,
    residentType: parsed.residentType ?? null,
    foreignerYn: parsed.foreignerYn ?? false,
    issueDate: parsed.issueDate ?? null,
    expiryDate: parsed.expiryDate ?? null,
    idNumberEncrypted: parsed.idNumber ? encrypt(parsed.idNumber) : null,
    idNumberMasked: parsed.idNumber ? maskIdNumber(parsed.idNumber) : null,
    addressEncrypted: parsed.address ? encrypt(parsed.address) : null,
    addressMasked: parsed.address ? maskAddress(parsed.address) : null,
    licenseNumberEncrypted: parsed.licenseNumber ? encrypt(parsed.licenseNumber) : null,
    licenseNumberMasked: parsed.licenseNumber ? maskIdNumber(parsed.licenseNumber) : null,
    verificationStatus: 'PENDING_REVIEW' as never,
  }
  const existing = await prisma.workerSensitiveIdentity.findUnique({ where: { workerId } })
  if (existing) {
    await prisma.workerSensitiveIdentity.update({ where: { workerId }, data })
  } else {
    await prisma.workerSensitiveIdentity.create({ data })
  }
}

export async function applyToWorker(
  workerId: string, documentId: string,
  actorUserId: string, actorRole: string,
  overwritePolicy: 'FILL_EMPTY_ONLY' | 'OVERWRITE_ALLOWED' = 'FILL_EMPTY_ONLY',
) {
  const doc = await prisma.workerIdentityDocument.findUnique({ where: { id: documentId }, include: { sensitiveData: true } })
  if (!doc || doc.workerId !== workerId) throw new Error('문서를 찾을 수 없습니다.')

  const worker = await prisma.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new Error('근로자를 찾을 수 없습니다.')

  const parsed = doc.parsedJson as ParsedIdDocument | null
  const conflicts: string[] = []
  const applied: string[] = []
  const updateData: Record<string, unknown> = {}

  const tryApply = (field: string, newVal: unknown, existingVal: unknown) => {
    if (newVal === undefined || newVal === null) return
    if (overwritePolicy === 'FILL_EMPTY_ONLY' && existingVal !== null && existingVal !== undefined && existingVal !== '') {
      if (existingVal !== newVal) conflicts.push(field)
      return
    }
    updateData[field] = newVal
    applied.push(field)
  }

  if (parsed) {
    tryApply('foreignerYn', parsed.foreignerYn, worker.foreignerYn)
  }
  const sensitive = doc.sensitiveData
  if (sensitive?.legalName) tryApply('name', sensitive.legalName, worker.name)

  if (Object.keys(updateData).length > 0) {
    await prisma.worker.update({ where: { id: workerId }, data: updateData })
  }
  await logAccess({ workerId, documentId, actionType: 'APPLY_TO_WORKER', actorUserId, actorRole })
  return { applied, conflicts }
}

export async function verifyDocument(workerId: string, documentId: string, actorUserId: string, actorRole: string) {
  await prisma.workerIdentityDocument.update({
    where: { id: documentId },
    data: { reviewStatus: 'VERIFIED' as never, reviewedBy: actorUserId, reviewedAt: new Date() },
  })
  await prisma.workerSensitiveIdentity.updateMany({
    where: { workerId, sourceDocumentId: documentId },
    data: { verificationStatus: 'VERIFIED' as never, verifiedBy: actorUserId, verifiedAt: new Date() },
  })
  await prisma.worker.update({
    where: { id: workerId },
    data: { idVerificationStatus: 'VERIFIED' as never, identityLastReviewedAt: new Date(), identityLastReviewedBy: actorUserId },
  })
  await logAccess({ workerId, documentId, actionType: 'VERIFY', actorUserId, actorRole })
}

export async function rejectDocument(
  workerId: string, documentId: string,
  newStatus: 'REJECTED' | 'RESCAN_REQUIRED', reason: string,
  actorUserId: string, actorRole: string,
) {
  await prisma.workerIdentityDocument.update({
    where: { id: documentId },
    data: { reviewStatus: newStatus as never, rejectedReason: reason, reviewedBy: actorUserId, reviewedAt: new Date() },
  })
  await prisma.worker.update({ where: { id: workerId }, data: { idVerificationStatus: newStatus as never } })
  await logAccess({ workerId, documentId, actionType: 'REJECT', actorUserId, actorRole, reason })
}

export async function logAccess(params: {
  workerId: string; documentId: string; actionType: string
  actorUserId: string; actorRole: string; reason?: string; ipAddress?: string
}) {
  try {
    await prisma.identityAccessLog.create({
      data: {
        workerId: params.workerId, documentId: params.documentId,
        actionType: params.actionType as never,
        actorUserId: params.actorUserId, actorRole: params.actorRole,
        ipAddress: params.ipAddress ?? null, reason: params.reason ?? null,
      },
    })
  } catch (e) { console.error('[identity] 로그 기록 실패:', e) }
}
