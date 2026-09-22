import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// リクエストごとに Supabase のセッション Cookie を更新する（期限切れトークンのリフレッシュ）
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          if (headers) {
            Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
          }
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // 静的ファイル・画像・PWA関連ファイルは除外
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|swe-worker-.*|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|mp3|wav)$).*)',
  ],
}
