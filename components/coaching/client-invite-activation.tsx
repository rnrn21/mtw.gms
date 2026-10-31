'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hashInviteToken, normalizeKoreanMobilePhone } from '@/lib/coaching/phone'

type InvitePreview = {
  client_name: string
  phone_hint: string | null
}

export function ClientInviteActivation({ token }: { token: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    async function loadInvite() {
      try {
        const digest = await hashInviteToken(token)
        const { data, error } = await supabase.rpc('get_invite_preview', {
          p_token_hash: digest,
        })

        if (!active) return

        if (error) {
          throw error
        }

        const invite = Array.isArray(data) ? data[0] : data
        if (!invite) {
          setErrorMessage('초대 링크가 만료되었거나 이미 사용되었습니다. 코치에게 새 링크를 요청해 주세요.')
          return
        }

        setTokenHash(digest)
        setPreview(invite as InvitePreview)
      } catch (error) {
        const message = error instanceof Error ? error.message : '초대 정보를 확인하지 못했습니다.'
        setErrorMessage(message)
      }
    }

    void loadInvite()
    return () => {
      active = false
    }
  }, [supabase, token])

  const requestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedPhone = normalizeKoreanMobilePhone(phoneInput)
    if (!normalizedPhone) {
      setErrorMessage('초대할 때 등록한 010 휴대폰 번호를 입력해 주세요.')
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { shouldCreateUser: true },
    })
    setIsSubmitting(false)

    if (error) {
      setErrorMessage('인증 문자를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
      console.error('초대 SMS 발송 실패:', error.message)
      return
    }

    setPhone(normalizedPhone)
    setMessage('문자로 받은 6자리 인증번호를 입력해 주세요.')
  }

  const verifyAndActivate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!phone || !tokenHash) return

    setIsSubmitting(true)
    setErrorMessage(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: 'sms',
    })

    if (verifyError) {
      setErrorMessage('인증번호가 올바르지 않거나 만료되었습니다.')
      console.error('초대 OTP 확인 실패:', verifyError.message)
      setIsSubmitting(false)
      return
    }

    const { error: claimError } = await supabase.rpc('claim_invite', {
      p_token_hash: tokenHash,
    })

    if (claimError) {
      await supabase.auth.signOut()
      setErrorMessage('초대를 활성화하지 못했습니다. 휴대폰 번호와 초대 링크를 확인해 주세요.')
      console.error('초대 활성화 실패:', claimError.message)
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
          <h1 className="font-serif text-2xl text-brand-primary">
            {preview ? `${preview.client_name}님, 반가워요` : '초대를 확인하고 있어요'}
          </h1>
          <p className="text-sm leading-[1.6] text-text-sub">
            {preview?.phone_hint
              ? `초대된 번호 ${preview.phone_hint}로 본인 확인을 진행해 주세요.`
              : '초대 링크로 안전하게 시작할 수 있도록 확인 중이에요.'}
          </p>
        </header>

        {preview && !phone && (
          <form onSubmit={requestCode} className="space-y-4">
            <label className="block space-y-1.5 text-sm text-text-main">
              <span>초대받은 휴대폰 번호</span>
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
        )}

        {preview && phone && (
          <form onSubmit={verifyAndActivate} className="space-y-4">
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
              {isSubmitting ? '확인 중...' : '확인하고 시작하기'}
            </button>
          </form>
        )}

        {errorMessage && (
          <p role="alert" className="text-sm leading-[1.6] text-red-700">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  )
}
