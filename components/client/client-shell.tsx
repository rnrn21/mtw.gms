'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  const [showBanner, setShowBanner] = useState(false)

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
        className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-[480px] grid-cols-3 border-t border-line bg-surface px-3 pb-[env(safe-area-inset-bottom)]"
      >
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
      </nav>
    </div>
  )
}
