import EmpresaGate from '@/components/EmpresaGate'
import SessionGuard from '@/components/SessionGuard'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <EmpresaGate>
        <div className="flex min-h-screen bg-gray-50 text-gray-900 print:bg-white">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="flex-1 p-6 print:p-0">{children}</main>
          </div>
        </div>
      </EmpresaGate>
    </SessionGuard>
  )
}
