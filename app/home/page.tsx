import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ClientHome } from '@/components/client/client-home'
import { ClientShell } from '@/components/client/client-shell'
import { getAccessContext } from '@/lib/supabase/access'

export default function HomePage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">고객 공간을 불러오고 있어요.</p>}>
      <AuthorizedHome />
    </Suspense>
  )
}

async function AuthorizedHome() {
  const access = await getAccessContext()
  if (!access || access.role !== 'client') redirect('/login')

  return (
    <ClientShell showHomeBanner>
      <ClientHome clientId={access.clientId} />
    </ClientShell>
  )
}
