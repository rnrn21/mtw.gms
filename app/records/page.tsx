import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ClientRecords } from '@/components/client/client-records'
import { ClientShell } from '@/components/client/client-shell'
import { getAccessContext } from '@/lib/supabase/access'

export default function RecordsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">기록을 불러오고 있어요.</p>}>
      <AuthorizedRecords />
    </Suspense>
  )
}

async function AuthorizedRecords() {
  const access = await getAccessContext()
  if (!access || access.role !== 'client') redirect('/login')

  return (
    <ClientShell>
      <ClientRecords clientId={access.clientId} />
    </ClientShell>
  )
}
