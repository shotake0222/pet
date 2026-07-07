import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  
  // 1. ログイン状態の確認
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. 管理者権限の確認
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    // 管理者でなければホーム画面へ強制送還
    redirect('/home');
  }

  // 管理者のみが以下のchildren（ダッシュボード画面）を描画できる
  return (
    
      
        🔧 Straid AR 管理ダッシュボード
        ログイン中: {user.email}
      
      
        {children}
      
    
  );
}