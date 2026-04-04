import { z } from 'zod'

export const exceptionRequestSchema = z.object({
  siteId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5, '사유를 5자 이상 입력하세요.'),
  type: z.enum([
    'CHECK_IN',         // 기존 출근 예외
    'CHECK_OUT',        // 기존 퇴근 예외
    'BOTH',             // 기존 양쪽 예외
    'MISSING_CHECKIN',  // 출근누락 신고
    'MISSING_CHECKOUT', // 퇴근누락 신고
    'LOCATION_MISMATCH',// 위치이탈 신고
    'SAFETY_HEALTH',    // 안전/건강 이상 신고
    'ACCIDENT',         // 사고/아차사고 신고
  ]),
})
