import { createBrowserClient } from '@supabase/ssr'

// @supabase/ssr のブラウザクライアントはセッションを Cookie に保存するため、
// サーバー側（/tag/[tagCode] や /auth/callback）からもログイン状態を参照できる。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
