import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // URL 끝에 슬래시(/)나 공백이 있으면 자동으로 제거
  url = url.trim().replace(/\/$/, '')

  if (!url || !anonKey) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.')
  }

  return createBrowserClient(url, anonKey)
}