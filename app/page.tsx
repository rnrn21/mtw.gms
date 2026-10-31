import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/supabase/access'

export default function Home() {
  return (
    <Suspense fallback={<p className="p-6 text-center">접속 정보를 확인하고 있어요.</p>}>
      <RouteByRole />
    </Suspense>
  )
}

async function RouteByRole(): Promise<never> {
  const access = await getAccessContext()
  if (!access) {
    return redirect('/login')
  }

  if (access.role === 'coach') return redirect('/coach')
  if (access.role === 'client') return redirect('/home')
  return redirect('/login')
}