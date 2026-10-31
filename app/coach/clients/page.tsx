import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { CoachClients } from '@/components/coach/coach-clients'
import { getAccessContext } from '@/lib/supabase/access'

export default function CoachClientsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">고객 목록을 불러오고 있어요.</p>}>
      <AuthorizedCoachClients />
    </Suspense>
  )
}

async function AuthorizedCoachClients() {
  const access = await getAccessContext()
  if (!access || access.role !== 'coach') redirect('/login')
  return <CoachClients />
}
