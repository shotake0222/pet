'use server';

import { createClient } from '@/utils/supabase/server';

export async function hatchPet(tagCode: string) {
  const supabase = createClient();

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
  const { data: newPet, error } = await supabase
    .from('pets')
    .insert({
      owner_id: user?.id,
      nfc_tag_id: tag.id,
      species_id: winner.id,
      status: 'active'
    })
    .select('*, pet_masters(name, model_url)')
    .single();

  if (error) throw error;

  return { success: true, pet: newPet };
}