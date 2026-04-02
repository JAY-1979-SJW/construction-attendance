export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand flex flex-col">
      {/* 공통 4px 오렌지 라인 */}
      <div className="h-1 bg-brand-accent shrink-0" />
      {/* 중앙 정렬 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}
