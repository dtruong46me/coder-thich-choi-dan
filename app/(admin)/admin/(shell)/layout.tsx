import { Suspense, type ReactNode } from 'react'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { requireOwnerPage } from '@/lib/access'
import { getAdminCounts } from '@/lib/db/queries/admin'

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <Suspense fallback={<aside className="admin-side" aria-busy="true" />}>
        <Sidebar />
      </Suspense>
      <main className="admin-main">{children}</main>
    </div>
  )
}

async function Sidebar() {
  const owner = await requireOwnerPage()
  const counts = await getAdminCounts(owner.userId)
  return <AdminSidebar counts={counts} email={owner.email} />
}
