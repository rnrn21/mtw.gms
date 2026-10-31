'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CoachForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)
    setIsSubmitting(true)

    const redirectTo = new URL('/auth/callback', window.location.origin)
    redirectTo.searchParams.set('next', '/reset-password')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo.toString(),
    })
    setIsSubmitting(false)

    if (error) {
      console.error('코치 비밀번호 재설정 메일 요청 실패:', error.message)
      setErrorMessage('재설정 메일을 보내지 못했습니다. 이메일 주소를 확인하고 다시 시도해 주세요.')
      return
    }

    setStatusMessage('해당 이메일 주소가 등록되어 있다면 재설정 링크를 보냈습니다. 메일함을 확인해 주세요.')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-app p-5">
      <section className="w-full space-y-6 rounded-xl border border-line bg-surface p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-sage">
            Mind Theory Works · 코치
          </p>
          <h1 className="font-serif text-2xl text-brand-primary">비밀번호 재설정</h1>
          <p className="text-sm leading-[1.6] text-text-sub">
            코치 계정 이메일을 입력하면 새 비밀번호 설정 링크를 보내드립니다.
          </p>
        </header>

        <form onSubmit={requestReset} className="space-y-4">
          <label className="block space-y-1.5 text-sm text-text-main">
            <span>코치 계정 이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-text-main outline-none focus:border-brand-sage"
              required
            />
          </label>

          {errorMessage && (
            <p role="alert" className="text-sm leading-[1.6] text-red-700">
              {errorMessage}
            </p>
          )}
          {statusMessage && (
            <p role="status" className="text-sm leading-[1.6] text-text-sub">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-primary px-4 py-3 text-sm text-white disabled:opacity-60"
          >
            {isSubmitting ? '메일 전송 중...' : '재설정 링크 보내기'}
          </button>
        </form>

        <Link
          href="/login"
          className="block text-center text-sm text-brand-primary underline underline-offset-2"
        >
          코치 로그인으로 돌아가기
        </Link>
      </section>
    </main>
  )
}
