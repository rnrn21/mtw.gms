import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { CoachFeedbackInbox } from '@/components/coach/coach-feedback-inbox'
import { getAccessContext } from '@/lib/supabase/access'

export default function CoachInboxPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">피드백 대기함을 불러오고 있어요.</p>}>
      <AuthorizedCoachInbox />
    </Suspense>
  )
}

async function AuthorizedCoachInbox() {
  const access = await getAccessContext()
  if (!access || access.role !== 'coach') redirect('/login')
  return <CoachFeedbackInbox />
}
