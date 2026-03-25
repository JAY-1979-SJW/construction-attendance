import LaborSidebar from './LaborSidebar'

export default function LaborLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <LaborSidebar />
      <main className="ml-[220px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
