import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeFile } from 'fs/promises'
import path from 'path'
import { parseEstimateDocument } from '@/lib/materials/estimate-parser'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get('siteId') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 20

  const where = { ...(siteId ? { siteId } : {}) }

  const [total, items] = await Promise.all([
    prisma.estimateDocument.count({ where }),
    prisma.estimateDocument.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { billRows: true, aggregateRows: true } },
      },
    }),
  ])

  return NextResponse.json({ success: true, data: { items, total, page, pageSize } })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const siteId = formData.get('siteId') as string | null
  const notes = formData.get('notes') as string | null
  const documentType = (formData.get('documentType') as string | null) ?? 'ESTIMATE'

  if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return NextResponse.json({ error: 'xlsx 또는 xls 파일만 지원합니다' }, { status: 400 })
  }

  // Save file
  const uploadDir = path.join(process.cwd(), 'uploads', 'estimates')
  const { mkdirSync } = await import('fs')
  mkdirSync(uploadDir, { recursive: true })

  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\-가-힣]/g, '_')}`
  const filePath = path.join(uploadDir, fileName)
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  // Create DB record
  const doc = await prisma.estimateDocument.create({
    data: {
      fileName: file.name,
      filePath,
      fileSize: file.size,
      uploadedBy: session.sub,
      siteId: siteId || null,
      notes: notes || null,
      documentType: documentType as never,
      parseStatus: 'UPLOADED',
    },
  })

  // Trigger parsing asynchronously
  parseEstimateDocument(doc.id).catch(console.error)

  return NextResponse.json({ success: true, data: doc })
}
