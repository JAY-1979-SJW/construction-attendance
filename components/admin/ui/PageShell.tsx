export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 md:p-6 bg-[#F5F7FA] min-h-screen ${className ?? ''}`}>
      {children}
    </div>
  )
}
