import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function TagEntryPoint({ params }: { params: { tagCode: string } }) {
  const supabase = createClient();
  
  // 1. 認証チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/tag/${params.tagCode}`);
  }

  // 2. タグとペットのデータチェック
  const { data: pet } = await supabase
    .from('pets')
    .select('*')
    .eq('nfc_tag_id', params.tagCode) // ※実際はtag_codeからnfc_tagsのidを引く処理が入ります
    .single();

  if (!pet) {
    // まだペットがいない場合（初回）の卵画面（またはAPI側で生成処理）へ
    redirect(`/home?tag=${params.tagCode}&status=egg`);
  }

  // 3. 育成中ならホームのAR画面へ
  redirect(`/home?tag=${params.tagCode}`);
}