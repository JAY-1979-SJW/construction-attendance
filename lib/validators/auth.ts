import { z } from 'zod'

export const phoneSchema = z
  .string()
  .regex(/^010\d{8}$/, '휴대폰 번호는 010으로 시작하는 11자리 숫자여야 합니다.')

export const sendOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['LOGIN', 'DEVICE_CHANGE']),
})

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, '인증번호는 6자리입니다.'),
  purpose: z.enum(['LOGIN', 'DEVICE_CHANGE']),
})
