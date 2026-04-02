import Link from 'next/link'

export default function WhyPage() {
  return (
    <Page title="왜 필요한가" summary="정확한 기록이 사업주와 근로자 모두를 보호합니다">
      <Item title="안전한 현장 운영" tag="산업안전보건법 제38조">
        중대재해처벌법이 전 사업장으로 확대되었습니다. 누가, 언제, 어디서 작업했는지 기록하면 안전관리 의무 이행을 증명할 수 있습니다.
      </Item>
      <Item title="투명한 근로 관계" tag="근로기준법 제48조">
        근로자는 자신의 기록을 직접 확인하고, 사업주는 정확한 데이터로 공정하게 정산합니다. 서로 확인할 수 있는 기록이 분쟁을 예방합니다.
      </Item>
      <Item title="정확한 정산과 신고" tag="고용보험법 제15조">
        정확한 근무일수로 4대보험과 퇴직공제가 빠짐없이 처리됩니다. 신고 누락 걱정 없이 기한 내 처리할 수 있습니다.
      </Item>
      <Cta />
    </Page>
  )
}

function Page({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-6 pb-10">
      <Link href="/m" className="text-[13px] text-gray-400 no-underline mb-4 block">← 메인</Link>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-[14px] text-gray-500 mb-6">{summary}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
function Item({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="text-[15px] font-bold text-gray-900 mb-2">{title}</div>
      <div className="text-[13px] text-gray-500 leading-[1.7] mb-2">{children}</div>
      <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{tag}</span>
    </div>
  )
}
function Cta() {
  return (
    <div className="mt-6">
      <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold text-center active:bg-orange-600">무료 시작하기</Link>
    </div>
  )
}
