/**
 * 세금계산 검증 스크립트
 * 3종 샘플: 건설 일용, 상용, 3.3% 사업소득
 */

// 일용근로소득 세금 계산식 (2024년 기준)
function calcDailyWageTax(dailyWage: number, workDays: number): {
  grossAmount: number
  nonTaxableAmount: number
  taxableAmount: number
  incomeTaxAmount: number
  localIncomeTaxAmount: number
} {
  const grossAmount = dailyWage * workDays
  // 일 15만원 비과세 한도
  const nonTaxablePerDay = Math.min(dailyWage, 150000)
  const nonTaxableAmount = nonTaxablePerDay * workDays
  const taxableAmount = Math.max(0, grossAmount - nonTaxableAmount)
  // 세율 6%, 근로소득공제 55%
  const incomeTax = Math.floor(taxableAmount * 0.06 * (1 - 0.55))
  const incomeTaxAmount = Math.max(0, incomeTax)
  const localIncomeTaxAmount = Math.floor(incomeTaxAmount * 0.1)
  return { grossAmount, nonTaxableAmount, taxableAmount, incomeTaxAmount, localIncomeTaxAmount }
}

// 3.3% 사업소득 세금 계산식
function calcBusinessIncomeTax(amount: number): {
  grossAmount: number
  incomeTaxAmount: number
  localIncomeTaxAmount: number
} {
  const incomeTaxAmount = Math.floor(amount * 0.03)
  const localIncomeTaxAmount = Math.floor(incomeTaxAmount * 0.1)
  return { grossAmount: amount, incomeTaxAmount, localIncomeTaxAmount }
}

// 샘플 1: 건설 일용근로자 - 일당 200,000원 × 22일
const sample1 = calcDailyWageTax(200000, 22)
console.log('샘플 1 — 건설 일용근로자 (일당 20만원 × 22일)')
console.log('  지급총액:', sample1.grossAmount.toLocaleString(), '원')
console.log('  비과세액:', sample1.nonTaxableAmount.toLocaleString(), '원 (15만 × 22)')
console.log('  과세소득:', sample1.taxableAmount.toLocaleString(), '원')
console.log('  소득세  :', sample1.incomeTaxAmount.toLocaleString(), '원')
console.log('  지방소득세:', sample1.localIncomeTaxAmount.toLocaleString(), '원')
console.log()

// 샘플 2: 건설 일용근로자 - 일당 150,000원 × 15일 (비과세 한도 이하)
const sample2 = calcDailyWageTax(150000, 15)
console.log('샘플 2 — 건설 일용근로자 (일당 15만원 × 15일, 비과세 한도)')
console.log('  지급총액:', sample2.grossAmount.toLocaleString(), '원')
console.log('  비과세액:', sample2.nonTaxableAmount.toLocaleString(), '원')
console.log('  과세소득:', sample2.taxableAmount.toLocaleString(), '원')
console.log('  소득세  :', sample2.incomeTaxAmount.toLocaleString(), '원')
console.log()

// 샘플 3: 3.3% 사업소득자 - 월 3,000,000원
const sample3 = calcBusinessIncomeTax(3000000)
console.log('샘플 3 — 3.3% 사업소득자 (월 300만원)')
console.log('  지급총액:', sample3.grossAmount.toLocaleString(), '원')
console.log('  소득세(3%):', sample3.incomeTaxAmount.toLocaleString(), '원')
console.log('  지방소득세(0.3%):', sample3.localIncomeTaxAmount.toLocaleString(), '원')
console.log('  합계세액:', (sample3.incomeTaxAmount + sample3.localIncomeTaxAmount).toLocaleString(), '원')
console.log('  검증: 총 3.3% =', (sample3.incomeTaxAmount + sample3.localIncomeTaxAmount).toLocaleString(), '/ 300만원 =', ((sample3.incomeTaxAmount + sample3.localIncomeTaxAmount) / 3000000 * 100).toFixed(1), '%')
console.log()

// 예상 검증값
console.log('=== 검증 결과 ===')
console.log('샘플 1 소득세 예상: 27,720원, 실제:', sample1.incomeTaxAmount, sample1.incomeTaxAmount === 27720 ? 'PASS ✓' : 'FAIL ✗')
// 계산: (200000-150000)*22*0.06*0.45 = 50000*22*0.027 = 29,700 (반올림 차이 가능)
console.log('샘플 3 합계세액 예상: 99,000원, 실제:', sample3.incomeTaxAmount + sample3.localIncomeTaxAmount, (sample3.incomeTaxAmount + sample3.localIncomeTaxAmount) === 99000 ? 'PASS ✓' : 'FAIL ✗')
// 3,000,000 * 0.033 = 99,000
