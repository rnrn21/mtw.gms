import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { hasSupabaseEnv } from "@/lib/supabase/env"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  if (!hasSupabaseEnv()) {
    return supabaseResponse
  }

  const pathname = request.nextUrl.pathname
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/client/login" ||
    pathname === "/client/login/help" ||
    pathname === "/login/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/invite/")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        supabaseResponse = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value)
        })
      },
    },
  })

  const { data, error } = await supabase.auth.getClaims()
  if (error && error.name !== "AuthSessionMissingError") {
    console.error("Supabase 세션 확인 실패:", error.message)
  }

  const hasSession = Boolean(data?.claims?.sub)

  if (!hasSession && !isPublicRoute && pathname !== "/") {
    const loginPath = pathname.startsWith("/coach") ? "/login" : "/client/login"
    return NextResponse.redirect(new URL(loginPath, request.url))
  }

  if (hasSession && (pathname === "/login" || pathname === "/client/login")) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return supabaseResponse
}
