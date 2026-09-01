import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // ✅ Googleログイン後のユーザープロファイル確保
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from('user_profiles').insert({
          id: data.user.id,
          email_notify_feed: true,
          email_notify_news: true,
          last_login_date: new Date().toLocaleDateString('sv-SE'),
          login_days: 1,
          is_admin: false
        });
      }
      
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // エラー時またはコード無しはログインページへ
  return NextResponse.redirect(`${origin}/login`);
}
