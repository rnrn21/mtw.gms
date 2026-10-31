import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const callbackUrl = new URL('/reset-password', request.url)
  const error = request.nextUrl.searchParams.get('error')
  const code = request.nextUrl.searchParams.get('code')
  const nextPath = request.nextUrl.searchParams.get('next')

  if (nextPath !== '/reset-password' || error || !code) {
    callbackUrl.searchParams.set('error', 'callback')
    return NextResponse.redirect(callbackUrl)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('비밀번호 재설정 콜백 처리 실패:', exchangeError.message)
    callbackUrl.searchParams.set('error', 'callback')
  }

  return NextResponse.redirect(callbackUrl)
}
