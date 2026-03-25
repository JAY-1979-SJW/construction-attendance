import { writeFile, mkdir, readFile as fsReadFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_ROOT = process.env.UPLOAD_ROOT_IDENTITY ?? path.join(process.cwd(), 'uploads', 'identity')

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

function datePath() {
  const now = new Date()
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function saveOriginalFile(buffer: Buffer, ext: string): Promise<string> {
  const subPath = `original/${datePath()}`
  await ensureDir(path.join(UPLOAD_ROOT, subPath))
  const fileKey = `${subPath}/${randomUUID()}${ext}`
  await writeFile(path.join(UPLOAD_ROOT, fileKey), buffer)
  return fileKey
}

export async function saveMaskedFile(buffer: Buffer, ext: string): Promise<string> {
  const subPath = `masked/${datePath()}`
  await ensureDir(path.join(UPLOAD_ROOT, subPath))
  const fileKey = `${subPath}/${randomUUID()}${ext}`
  await writeFile(path.join(UPLOAD_ROOT, fileKey), buffer)
  return fileKey
}

export async function readIdentityFile(fileKey: string): Promise<Buffer> {
  return fsReadFile(path.join(UPLOAD_ROOT, fileKey))
}

export async function deleteIdentityFile(fileKey: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_ROOT, fileKey))
  } catch (err) {
    // 파일 미존재는 정상 케이스(이미 삭제됨), 다른 오류는 경고 로그
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[identity-storage] 파일 삭제 실패 — 수동 확인 필요', { fileKey, err })
    }
  }
}

export function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/jpg': '.jpg',
    'image/png': '.png', 'image/webp': '.webp',
  }
  return map[mime] ?? '.bin'
}
