import { z } from 'zod'

export const exceptionRequestSchema = z.object({
  siteId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5, '사유를 5자 이상 입력하세요.'),
  type: z.enum(['CHECK_IN', 'CHECK_OUT', 'BOTH']),
})
