import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ClientLibrary } from '@/components/client/client-library'
import { ClientShell } from '@/components/client/client-shell'
import { getAccessContext } from '@/lib/supabase/access'

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">서재를 불러오고 있어요.</p>}>
      <AuthorizedLibrary />
    </Suspense>
  )
}

async function AuthorizedLibrary() {
  const access = await getAccessContext()
  if (!access || access.role !== 'client') redirect('/login')

  return (
    <ClientShell>
      <ClientLibrary clientId={access.clientId} />
    </ClientShell>
  )
}
