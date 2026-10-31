'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const tabs = [
  { href: '/home', label: '홈' },
  { href: '/records', label: '기록' },
  { href: '/library', label: '서재' },
]

export function ClientShell({
  children,
  showHomeBanner = false,
}: {
  children: React.ReactNode
  showHomeBanner?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [showBanner, setShowBanner] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const signOut = async () => {
    setIsSigningOut(true)
    setSignOutError(null)
    const { error } = await createClient().auth.signOut({ scope: 'local' })

    if (error) {
      console.error('고객 로그아웃 실패:', error.message)
      setSignOutError('로그아웃하지 못했습니다. 다시 시도해 주세요.')
      setIsSigningOut(false)
      return
    }

    router.replace('/client/login')
    router.refresh()
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () =>
        setShowBanner(
          showHomeBanner && window.localStorage.getItem('mtw-home-tip-dismissed') !== 'true',
        ),
      0,
    )
    return () => window.clearTimeout(timeoutId)
  }, [showHomeBanner])

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-app">
      {showBanner && (
        <aside className="border-b border-line bg-brand-sage-tint px-5 py-3 text-sm text-text-main">
          <div className="flex items-start justify-between gap-3">
            <p>
              이 페이지를 홈 화면에 추가하면 세션 사이에 더 편하게 이어갈 수 있어요.
              브라우저 메뉴에서 ‘홈 화면에 추가’를 선택해 보세요.
            </p>
            <button
              type="button"
              aria-label="안내 닫기"
              onClick={() => {
                window.localStorage.setItem('mtw-home-tip-dismissed', 'true')
                setShowBanner(false)
              }}
              className="shrink-0 text-text-sub"
            >
              닫기
            </button>
          </div>
        </aside>
      )}
      <main className="min-h-screen px-5 pb-28 pt-7">{children}</main>
      <nav
        aria-label="고객 메뉴"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-[480px] grid-cols-4 border-t border-line bg-surface px-3 pb-[env(safe-area-inset-bottom)]"
      >
        {signOutError && (
          <p role="alert" className="col-span-4 px-2 pt-2 text-center text-xs text-red-700">
            {signOutError}
          </p>
        )}
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`py-3 text-center text-sm ${
                isActive ? 'font-medium text-brand-primary' : 'text-text-sub'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={signOut}
          disabled={isSigningOut}
          className="py-3 text-center text-sm text-text-sub disabled:opacity-60"
        >
          {isSigningOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </nav>
    </div>
  )
}
