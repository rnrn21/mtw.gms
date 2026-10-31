import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ClientInviteActivation } from '@/components/coaching/client-invite-activation'

export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  return (
    <Suspense fallback={<p className="p-6 text-center">초대 링크를 확인하고 있어요.</p>}>
      <InviteContent params={params} />
    </Suspense>
  )
}

async function InviteContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ClientInviteActivation token={token} />
}
