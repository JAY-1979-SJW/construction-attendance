import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.IDENTITY_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'fallback-dev-key-32chars-minimum!!'
  return scryptSync(secret, 'identity-salt-v1', 32)
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.slice(0, 16)
  const tag = buf.slice(16, 32)
  const encrypted = buf.slice(32)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

export function maskIdNumber(id: string): string {
  if (!id) return ''
  if (/^\d{6}-\d{7}$/.test(id)) return id.slice(0, 8) + '******'
  if (/^\d{6}-[0-9A-Z]\d{6}$/.test(id)) return id.slice(0, 8) + '******'
  if (id.length >= 8) return id.slice(0, -4) + '****'
  return id.slice(0, 2) + '****'
}

export function maskAddress(address: string): string {
  if (!address) return ''
  const parts = address.split(' ')
  if (parts.length <= 2) return address
  return parts.slice(0, 2).join(' ') + ' ***'
}
