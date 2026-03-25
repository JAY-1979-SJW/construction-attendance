import { writeFile, mkdir, readFile as fsReadFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID, createHash } from 'crypto'

const UPLOAD_ROOT = process.env.UPLOAD_ROOT_DOCUMENTS ?? path.join(process.cwd(), 'uploads', 'documents')

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

function datePath() {
  const now = new Date()
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  }
  return map[mime] ?? '.bin'
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export const MAX_FILE_SIZE = 20 * 1024 * 1024  // 20MB

/** 문서 파일 저장. storageProvider=LOCAL */
export async function saveDocumentFile(
  buffer: Buffer,
  workerId: string,
  mimeType: string,
): Promise<{ path: string; sha256Hash: string; sizeBytes: number }> {
  const ext = getExtFromMime(mimeType)
  const subPath = `${workerId}/${datePath()}`
  const absDir = path.join(UPLOAD_ROOT, subPath)
  await ensureDir(absDir)
  const filename = `${randomUUID()}${ext}`
  const relPath = `${subPath}/${filename}`
  await writeFile(path.join(UPLOAD_ROOT, relPath), buffer)
  const sha256Hash = createHash('sha256').update(buffer).digest('hex')
  return { path: relPath, sha256Hash, sizeBytes: buffer.length }
}

/** 문서 파일 읽기 */
export async function readDocumentFile(relPath: string): Promise<Buffer> {
  return fsReadFile(path.join(UPLOAD_ROOT, relPath))
}
