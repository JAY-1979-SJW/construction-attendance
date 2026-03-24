import AdminLayoutWrapper from '@/components/admin/AdminLayoutWrapper'

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>
}
