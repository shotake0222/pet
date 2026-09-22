import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function TagEntryPoint({ params }: { params: Promise<{ tagCode: string }> }) {
  // Next.js 15 以降、params は Promise なので await が必要
  const { tagCode } = await params;
  const encodedTag = encodeURIComponent(tagCode);
  const supabase = await createClient();

  // 1. 認証チェック（ログイン後にこのタグへ戻ってこられるよう next を付ける）
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/tag/${tagCode}`)}`);
  }

  // 2. tag_code から nfc_tags の id を引く
  const { data: tag } = await supabase
    .from('nfc_tags')
    .select('id')
    .eq('tag_code', tagCode)
    .maybeSingle();

  if (!tag) {
    // 未登録のタグ
    redirect(`/home?tag_id=${encodedTag}&status=invalid_tag`);
  }

  // 3. そのタグに紐づく自分のペットを確認
  const { data: pet } = await supabase
    .from('pets')
    .select('id')
    .eq('nfc_tag_id', tag.id)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!pet) {
    // まだペットがいない場合（初回）は卵画面へ
    redirect(`/home?tag_id=${encodedTag}&status=egg`);
  }

  // 4. 育成中ならホームのAR画面へ
  redirect(`/home?tag_id=${encodedTag}`);
}
