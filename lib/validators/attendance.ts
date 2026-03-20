import { z } from 'zod'

export const checkInSchema = z.object({
  qrToken: z.string().min(1, 'QR 토큰이 필요합니다.'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deviceToken: z.string().min(1, 'device 토큰이 필요합니다.'),
})

export const checkOutSchema = checkInSchema
export const moveSchema = checkInSchema

export const exceptionRequestSchema = z.object({
  siteId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5, '사유를 5자 이상 입력하세요.'),
  type: z.enum(['CHECK_IN', 'CHECK_OUT', 'BOTH']),
})
