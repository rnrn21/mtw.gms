import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { CoachSessionWorkspace } from '@/components/coach/coach-session-workspace'
import { getAccessContext } from '@/lib/supabase/access'

export default function CoachSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  return (
    <Suspense fallback={<p className="p-6 text-center">세션 공간을 불러오고 있어요.</p>}>
      <AuthorizedCoachSession params={params} />
    </Suspense>
  )
}

async function AuthorizedCoachSession({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const access = await getAccessContext()
  if (!access || access.role !== 'coach') redirect('/login')

  const { sessionId } = await params
  return <CoachSessionWorkspace sessionId={sessionId} />
}
