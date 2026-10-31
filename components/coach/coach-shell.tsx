'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const items = [
  { href: '/coach', label: '오늘' },
  { href: '/coach/clients', label: '고객' },
  { href: '/coach/inbox', label: '대기함' },
]

export function CoachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const signOut = async () => {
    setIsSigningOut(true)
    setSignOutError(null)
    const { error } = await createClient().auth.signOut({ scope: 'local' })

    if (error) {
      console.error('코치 로그아웃 실패:', error.message)
      setSignOutError('로그아웃하지 못했습니다. 다시 시도해 주세요.')
      setIsSigningOut(false)
      return
    }

    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-app text-text-main md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-surface px-5 py-5 md:sticky md:top-0 md:flex md:min-h-screen md:flex-col md:border-b-0 md:border-r md:px-6">
        <Link href="/coach" className="font-serif text-lg text-brand-primary">
          Mind Theory Works
        </Link>
        <nav aria-label="코치 메뉴" className="mt-5 flex gap-2 md:flex-col">
          {items.map((item) => {
            const isActive =
              item.href === '/coach' ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-brand-sage-tint font-medium text-brand-primary' : 'text-text-sub'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-4 md:mt-auto md:pt-6">
          {signOutError && (
            <p role="alert" className="mb-2 text-sm leading-[1.6] text-red-700">
              {signOutError}
            </p>
          )}
          <button
            type="button"
            onClick={signOut}
            disabled={isSigningOut}
            className="px-3 py-2 text-left text-xs text-text-sub/70 transition-colors hover:text-text-sub disabled:opacity-60"
          >
            {isSigningOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-7 md:px-8 lg:px-10">{children}</main>
    </div>
  )
}
