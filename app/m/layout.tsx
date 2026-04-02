import PublicChatWidget from '@/components/PublicChatWidget'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 font-[Pretendard,system-ui,sans-serif]">
      <div className="h-1 bg-orange-500 shrink-0" />
      {children}
      <PublicChatWidget />
    </div>
  )
}
