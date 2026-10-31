'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizeKoreanMobilePhone } from '@/lib/coaching/phone'

export default function ClientLoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setMessage(null)

    const normalizedPhone = normalizeKoreanMobilePhone(phoneInput)
    if (!normalizedPhone) {
      setErrorMessage('010으로 시작하는 휴대폰 번호를 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { shouldCreateUser: false },
    })
    setIsSubmitting(false)

    if (error) {
      setErrorMessage('인증 문자를 보내지 못했습니다. 번호를 확인하거나 코치에게 초대 링크를 요청해 주세요.')
      console.error('고객 OTP 발송 실패:', error.message)
      return
    }

    setPhone(normalizedPhone)
    setMessage('문자로 받은 6자리 인증번호를 입력해 주세요.')
  }

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!phone) return

    setIsSubmitting(true)
    setErrorMessage(null)
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: 'sms',
    })

    if (error) {
      setErrorMessage('인증번호가 올바르지 않거나 만료되었습니다.')
      console.error('고객 OTP 확인 실패:', error.message)
      setIsSubmitting(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .maybeSingle()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setErrorMessage('연결된 고객 프로필이 없습니다. 코치에게 새 초대 링크를 요청해 주세요.')
      if (profileError) console.error('고객 프로필 확인 실패:', profileError.message)
      setIsSubmitting(false)
      return
    }

    router.replace('/home')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-app p-5">
      <section className="w-full space-y-6 rounded-xl border border-line bg-surface p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-sage">
            Mind Theory Works
          </p>
          <h1 className="font-serif text-2xl text-brand-primary">다시 만나요</h1>
          <p className="text-sm leading-[1.6] text-text-sub">
            초대받은 휴대폰 번호로 인증해 주세요.
          </p>
        </header>

        {!phone ? (
          <form onSubmit={requestCode} className="space-y-4">
            <label className="block space-y-1.5 text-sm text-text-main">
              <span>휴대폰 번호</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="010-1234-5678"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand-sage"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-brand-primary px-4 py-3 text-sm text-white disabled:opacity-60"
            >
              {isSubmitting ? '전송 중...' : '인증번호 받기'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm leading-[1.6] text-text-sub">{message}</p>
            <label className="block space-y-1.5 text-sm text-text-main">
              <span>6자리 인증번호</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 tracking-[0.3em] outline-none focus:border-brand-sage"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="w-full rounded-lg bg-brand-primary px-4 py-3 text-sm text-white disabled:opacity-60"
            >
              {isSubmitting ? '확인 중...' : '확인'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhone(null)
                setCode('')
                setMessage(null)
              }}
              className="w-full text-sm text-text-sub underline underline-offset-2"
            >
              번호 다시 입력
            </button>
          </form>
        )}

        {errorMessage && (
          <p role="alert" className="text-sm leading-[1.6] text-red-700">
            {errorMessage}
          </p>
        )}

        <Link
          href="/client/login/help"
          className="block text-center text-sm text-brand-primary underline underline-offset-2"
        >
          인증에 문제가 있나요?
        </Link>
      </section>
    </main>
  )
}
