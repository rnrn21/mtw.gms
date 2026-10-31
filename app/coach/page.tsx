import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { CoachTodayBoard } from '@/components/coach/coach-today-board'
import { getAccessContext } from '@/lib/supabase/access'

export default function CoachTodayPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">오늘의 코칭을 불러오고 있어요.</p>}>
      <AuthorizedCoachToday />
    </Suspense>
  )
}

async function AuthorizedCoachToday() {
  const access = await getAccessContext()
  if (!access || access.role !== 'coach') redirect('/login')
  return <CoachTodayBoard />
}
