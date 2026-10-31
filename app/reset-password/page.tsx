'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RecoveryStatus = 'checking' | 'ready' | 'invalid' | 'updated'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [status, setStatus] = useState<RecoveryStatus>('checking')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    const checkRecoverySession = async () => {
      if (new URLSearchParams(window.location.search).has('error')) {
        if (active) setStatus('invalid')
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        console.error('비밀번호 재설정 세션 확인 실패:', error.message)
      }

      setStatus(data.session ? 'ready' : 'invalid')
    }

    void checkRecoverySession()
    return () => {
      active = false
    }
  }, [supabase])

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage('새 비밀번호는 8자 이상 입력해 주세요.')
      return
    }

    if (password !== passwordConfirmation) {
      setErrorMessage('비밀번호가 서로 일치하지 않습니다.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('코치 비밀번호 변경 실패:', error.message)
      setErrorMessage('비밀번호를 변경하지 못했습니다. 재설정 링크가 만료되었거나 비밀번호 정책에 맞지 않을 수 있습니다.')
      setIsSubmitting(false)
      return
    }

    setStatus('updated')
    setIsSubmitting(false)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-app p-5">
      <section className="w-full space-y-6 rounded-xl border border-line bg-surface p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-sage">
            Mind Theory Works
          </p>
          <h1 className="font-serif text-2xl text-brand-primary">비밀번호 재설정</h1>
          <p className="text-sm leading-[1.6] text-text-sub">
            코치 계정의 새 비밀번호를 설정합니다.
          </p>
        </header>

        {status === 'checking' && (
          <p role="status" className="text-sm leading-[1.6] text-text-sub">
            재설정 링크를 확인하고 있어요.
          </p>
        )}

        {status === 'ready' && (
          <form onSubmit={updatePassword} className="space-y-4">
            <label className="block space-y-1.5 text-sm text-text-main">
              <span>새 비밀번호 (8자 이상)</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-text-main outline-none focus:border-brand-sage"
                required
              />
            </label>
            <label className="block space-y-1.5 text-sm text-text-main">
              <span>새 비밀번호 확인</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
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
              {isSubmitting ? '저장 중...' : '새 비밀번호 저장'}
            </button>
          </form>
        )}

        {status === 'invalid' && (
          <div className="space-y-4">
            <p role="alert" className="text-sm leading-[1.6] text-red-700">
              재설정 링크가 유효하지 않거나 만료되었습니다. 코치 로그인 화면에서 새 재설정 메일을 요청해 주세요. Supabase의 Redirect URL 설정에 현재 앱 주소가 허용되어 있는지도 확인해 주세요.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-lg bg-brand-primary px-4 py-3 text-center text-sm text-white"
            >
              코치 로그인으로 돌아가기
            </Link>
          </div>
        )}

        {status === 'updated' && (
          <div className="space-y-4">
            <p role="status" className="text-sm leading-[1.6] text-text-sub">
              비밀번호가 변경되었습니다. 코치 화면으로 이동해 주세요.
            </p>
            <button
              type="button"
              onClick={() => router.replace('/')}
              className="w-full rounded-lg bg-brand-primary px-4 py-3 text-sm text-white"
            >
              코치 화면으로 이동
            </button>
          </div>
        )}

        {status !== 'updated' && (
          <p className="text-center text-sm leading-[1.6] text-text-sub">
            <Link className="underline underline-offset-2" href="/login">
              코치 로그인
            </Link>
          </p>
        )}
      </section>
    </main>
  )
}
