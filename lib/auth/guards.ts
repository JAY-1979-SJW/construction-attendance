import { cookies } from 'next/headers'
import { verifyToken } from './jwt'
import type { JwtPayload } from '@/types/auth'

export async function getWorkerSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('worker_token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getAdminSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.type !== 'admin') return null
  return payload
}

export async function requireWorker(): Promise<JwtPayload> {
  const session = await getWorkerSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

export async function requireAdmin(): Promise<JwtPayload> {
  const session = await getAdminSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}
