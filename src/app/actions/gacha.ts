'use server';

import { createClient } from '@/utils/supabase/server';

export async function hatchPet(tagCode: string) {
  const supabase = await createClient();

  // 1. NFCタグの存在確認と所有者チェック
  const { data: tag } = await supabase
    .from('nfc_tags')
    .select('id')
    .eq('tag_code', tagCode)
    .single();

  if (!tag) throw new Error("無効なキーホルダーです");

  // 2. 全ペットマスターを取得
  const { data: masters } = await supabase
    .from('pet_masters')
    .select('id, drop_weight');

  if (!masters) throw new Error("設定データがありません");

  // 3. 重み付き抽選ロジック
  const totalWeight = masters.reduce((sum, p) => sum + p.drop_weight, 0);
  const random = Math.random() * totalWeight;
  let currentWeight = 0;
  let winner = masters[0];

  for (const pet of masters) {
    currentWeight += pet.drop_weight;
    if (random < currentWeight) {
      winner = pet;
      break;
    }
  }

  // 4. ペットを確定させてDB登録
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data: newPet, error } = await supabase
    .from('pets')
    .insert({
      owner_id: user.id,
      nfc_tag_id: tag.id,
      // アプリ全体では種族を pet_master_id で参照しているため、そちらに保存する
      pet_master_id: winner.id,
      is_egg: false,
      status: 'active'
    })
    .select('*, pet_masters!pet_master_id(name, model_url, rarity, model_url_v2, model_url_v3, marker_url)')
    .single();

  if (error) throw error;

  return { success: true, pet: newPet };
}