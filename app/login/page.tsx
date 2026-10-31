'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CoachLoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrorMessage('로그인 정보를 확인해 주세요.')
      console.error('코치 로그인 실패:', error.message)
      setIsSubmitting(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-app p-5">
      <section className="w-full space-y-6 rounded-xl border border-line bg-surface p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-sage">
            Mind Theory Works
          </p>
          <h1 className="font-serif text-2xl text-brand-primary">코치 로그인</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm text-text-main">
            <span>이메일</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-text-main outline-none focus:border-brand-sage"
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm text-text-main">
            <span>비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-text-main outline-none focus:border-brand-sage"
              required
            />
          </label>

          {errorMessage && (
            <p role="alert" className="text-sm leading-[1.6] text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-primary px-4 py-3 text-sm text-white disabled:opacity-60"
          >
            {isSubmitting ? '확인 중...' : '로그인'}
          </button>
        </form>

        <Link
          href="/login/forgot-password"
          className="block text-center text-sm text-brand-primary underline underline-offset-2"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </section>
    </main>
  )
}
