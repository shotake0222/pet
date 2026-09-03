/**
 * スポット検証・ゲーム管理ユーティリティ
 *
 * 【修正内容】
 * - 参照テーブルを 'spots' → 'landmarks' に変更（'spots' テーブルは存在しないため）
 * - 施設タイプごとのゲーム発生確率判定を追加
 * - 報酬をアイテム / クーポンの両対応にし、確率抽選を実装
 *   （以前は reward_type: 'coupon' 固定のハードコードだった）
 */

import { createClient } from '@/utils/supabase/client';

export type FacilityType = 'normal' | 'special' | 'restaurant' | 'hospital' | 'hotel';

/**
 * スポット名から施設タイプを推測（マスターに facility_type が無い場合のフォールバック）
 */
export const getFacilityTypeByName = (name: string): FacilityType => {
  if (!name) return 'normal';
  if (name.includes('ご飯') || name.includes('レストラン') || name.includes('カフェ')) return 'restaurant';
  if (name.includes('病院') || name.includes('クリニック') || name.includes('ドクター')) return 'hospital';
  if (name.includes('ホテル') || name.includes('宿')) return 'hotel';
  return 'normal';
};

/**
 * スポットオブジェクトから施設タイプを解決する
 */
export const resolveFacilityType = (spot: any): FacilityType => {
  if (!spot) return 'normal';
  if (spot.isCustom) return 'normal';
  const master = spot.landmark_masters;
  if (master?.facility_type && master.facility_type !== 'normal') {
    return master.facility_type as FacilityType;
  }
  return getFacilityTypeByName(spot.name);
};

/**
 * 現在位置がスポット内か判定（Haversine公式）
 */
export const isUserAtSpot = (
  userLat: number,
  userLng: number,
  spotLat: number,
  spotLng: number,
  radiusMeters: number,
  isDebugMode: boolean = false
): boolean => {
  // デバッグモード：常に true
  if (isDebugMode) return true;

  const R = 6371000; // 地球の半径（メートル）
  const lat1 = (userLat * Math.PI) / 180;
  const lat2 = (spotLat * Math.PI) / 180;
  const deltaLat = ((spotLat - userLat) * Math.PI) / 180;
  const deltaLng = ((spotLng - userLng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= radiusMeters;
};

/**
 * 利用可能なスポットを取得
 * 🚨 期間外のスポットをフィルタリング：start_time と end_time で制御
 *
 * 【重要】landmarks テーブルには大量のデータが入っているため、
 * 検索範囲を絞らずに取得すると PostgREST のデフォルト上限で
 * 切り捨てられ、近くのスポットが取得できないことがある。
 * 必ず座標で範囲を絞ってから取得すること。
 */
export const getAvailableSpots = async (
  userLat: number,
  userLng: number,
  searchRadiusKm: number = 5,
  isDebugMode: boolean = false
) => {
  const supabase = createClient();
  const now = new Date().toISOString();

  const latOffset = searchRadiusKm / 111; // 1度 ≈ 111km
  const lngOffset = searchRadiusKm / (111 * Math.cos((userLat * Math.PI) / 180));

  const { data, error } = await supabase
    .from('landmarks')
    .select('*, landmark_masters:landmark_master_id(facility_type, name)')
    .gte('latitude', userLat - latOffset)
    .lte('latitude', userLat + latOffset)
    .gte('longitude', userLng - lngOffset)
    .lte('longitude', userLng + lngOffset)
    // 期間フィルタリング：start_time is null OR start_time <= now
    .or(`start_time.is.null,start_time.lte.${now}`)
    // 期間フィルタリング：end_time is null OR end_time >= now
    .or(`end_time.is.null,end_time.gte.${now}`)
    .limit(1000);

  if (error) throw error;

  const spots = data || [];

  // デバッグモードでは距離判定をスキップし、範囲内の全スポットを返す
  if (isDebugMode) return spots;

  // 詳密な距離計算でフィルター
  return spots.filter((spot: any) =>
    isUserAtSpot(
      userLat,
      userLng,
      Number(spot.latitude),
      Number(spot.longitude),
      Number(spot.radius_meters) || 50
    )
  );
};

/**
 * 🎲 スポット到達時に、どのゲームが発生するかを施設タイプ別の確率で抽選する
 *
 * @param facilityType スポットの施設タイプ
 * @param forceGameType デバッグ用。指定するとそのゲームを確率無視で返す
 * @returns 発生したゲーム（発生しなかった場合は null）
 */
export const rollGameEncounter = async (
  facilityType: FacilityType,
  forceGameType?: string | null
) => {
  const supabase = createClient();

  // デバッグ用の強制起動
  if (forceGameType) {
    const { data: forced, error: forcedError } = await supabase
      .from('games')
      .select('*')
      .eq('game_type', forceGameType)
      .maybeSingle();
    if (forcedError) {
      console.error('🔴 ゲーム強制取得エラー:', forcedError);
      return null;
    }
    return forced || null;
  }

  const { data: rates, error } = await supabase
    .from('game_encounter_rates')
    .select('*, games:game_id(*)')
    .eq('facility_type', facilityType)
    .eq('is_active', true);

  if (error) {
    console.error('🔴 ゲーム発生確率の取得エラー:', error);
    return null;
  }

  const candidates = (rates || []).filter((r: any) => r.games?.is_active);
  if (candidates.length === 0) return null;

  // 各ゲームごとに独立して抽選し、当たったものの中から1つ選ぶ
  const hits = candidates.filter((r: any) => Math.random() * 100 < (r.encounter_rate_percent || 0));
  if (hits.length === 0) return null;

  const picked = hits[Math.floor(Math.random() * hits.length)];
  return picked.games;
};

/**
 * ユーザーのゲーム進捗を取得
 */
export const getUserGameProgress = async (userId: string, gameId: number) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) throw error;

  return data || null;
};

/**
 * アンロック可能なゲーム一覧を取得
 */
export const getUnlockedGames = async (userId: string, isDebugMode: boolean = false) => {
  const supabase = createClient();

  const { data: allGames, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (gamesError) throw gamesError;

  const { data: progressData, error: progressError } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId);

  if (progressError) throw progressError;

  const totalClears = (progressData || []).reduce((sum, p) => sum + (p.clear_count || 0), 0);

  return (allGames || []).map((game) => {
    const progress = (progressData || []).find((p) => p.game_id === game.id);
    // デバッグモード時は全ゲームアンロック
    const isUnlocked = isDebugMode ? true : totalClears >= (game.unlocked_by_clear_count || 0);

    return {
      ...game,
      progress: progress || { clear_count: 0, best_score: 0, last_played_at: null },
      isUnlocked,
    };
  });
};

/**
 * 🎁 ゲームクリア報酬を抽選する（アイテム / クーポン両対応）
 *
 * game_reward_masters に登録された候補のうち、
 * - そのゲーム向け
 * - 施設タイプが一致（または全施設共通）
 * - min_score 以上のスコア
 * を満たすものを、それぞれ drop_rate_percent の確率で抽選する。
 */
export const rollGameRewards = async (
  gameId: number,
  facilityType: FacilityType | null,
  score: number = 0
) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_reward_masters')
    .select('*, item_masters:item_id(*), coupon_masters:coupon_id(*)')
    .eq('game_id', gameId)
    .eq('is_active', true);

  if (error) {
    console.error('🔴 報酬マスターの取得エラー:', error);
    return [];
  }

  const candidates = (data || []).filter((r: any) => {
    if ((r.min_score || 0) > score) return false;
    // facility_type が null のものは全施設共通
    if (r.facility_type && facilityType && r.facility_type !== facilityType) return false;
    return true;
  });

  return candidates.filter((r: any) => Math.random() * 100 < (r.drop_rate_percent || 0));
};

/**
 * 抽選された報酬を実際にユーザーへ付与する
 * - アイテム: user_inventory に加算
 * - クーポン: game_rewards にQRコード付きで発行
 */
export const grantGameRewards = async (
  userId: string,
  gameId: number,
  rewards: any[],
  spotId?: string | null
) => {
  const supabase = createClient();
  const granted: any[] = [];

  for (const reward of rewards) {
    try {
      if (reward.reward_type === 'item' && reward.item_id) {
        const amount = reward.drop_amount || 1;
        const { data: existing } = await supabase
          .from('user_inventory')
          .select('id, quantity')
          .eq('user_id', userId)
          .eq('item_id', reward.item_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('user_inventory')
            .update({ quantity: (existing.quantity || 0) + amount })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('user_inventory')
            .insert({ user_id: userId, item_id: reward.item_id, quantity: amount });
        }

        granted.push({
          type: 'item',
          name: reward.item_masters?.name || 'アイテム',
          image_url: reward.item_masters?.image_url || null,
          item_type: reward.item_masters?.item_type || null,
          amount,
        });
      } else if (reward.reward_type === 'coupon' && reward.coupon_id) {
        const issued = await createGameReward(userId, gameId, spotId, reward);
        if (issued) {
          granted.push({
            type: 'coupon',
            name: reward.coupon_masters?.name || 'クーポン',
            image_url: reward.coupon_masters?.qr_image_url || null,
            amount: reward.drop_amount || 1,
            reward_code: issued.reward_code,
          });
        }
      }
    } catch (e) {
      console.error('🔴 報酬付与エラー:', e, reward);
    }
  }

  return granted;
};

/**
 * ゲームをクリア（進捗更新 + 解放判定 + 報酬付与）
 *
 * @returns 付与された報酬の配列
 */
export const completeGame = async (
  userId: string,
  gameId: number,
  score: number = 0,
  spotId?: string | null,
  facilityType: FacilityType | null = null
) => {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('game_progress')
      .update({
        clear_count: (existing.clear_count || 0) + 1,
        best_score: Math.max(existing.best_score || 0, score),
        last_played_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('game_progress').insert({
      user_id: userId,
      game_id: gameId,
      clear_count: 1,
      best_score: score,
      last_played_at: new Date().toISOString(),
    });
  }

  // クリア数に応じてゲームをアンロック
  const { data: allGames } = await supabase.from('games').select('*').eq('is_active', true);
  const { data: progressData } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId);

  const totalClears = (progressData || []).reduce((sum, p) => sum + (p.clear_count || 0), 0);
  const gamesToUnlock = (allGames || []).filter(
    (g) => (g.unlocked_by_clear_count || 0) <= totalClears
  );

  for (const game of gamesToUnlock) {
    const { data: alreadyUnlocked } = await supabase
      .from('user_game_unlocks')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', game.id)
      .maybeSingle();

    if (!alreadyUnlocked) {
      await supabase.from('user_game_unlocks').insert({ user_id: userId, game_id: game.id });
    }
  }

  // 🎁 報酬を抽選して付与
  const rolled = await rollGameRewards(gameId, facilityType, score);
  const granted = await grantGameRewards(userId, gameId, rolled, spotId);

  return granted;
};

/**
 * クーポン報酬を game_rewards に発行する（QRコード付き）
 */
export const createGameReward = async (
  userId: string,
  gameId: number,
  spotId?: string | null,
  rewardMaster?: any
) => {
  const supabase = createClient();

  // ユニークな報酬コードを生成
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const rewardCode = `${timestamp}-${random}`;
  // QRコードにスポット情報を含める
  const qrData = spotId ? `${rewardCode}:${userId}:${spotId}` : `${rewardCode}:${userId}`;

  // 有効期限を30日後に設定
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabase
    .from('game_rewards')
    .insert({
      user_id: userId,
      game_id: gameId,
      spot_id: spotId ? String(spotId) : null,
      reward_code: rewardCode,
      reward_type: 'coupon',
      coupon_id: rewardMaster?.coupon_id || null,
      amount: rewardMaster?.drop_amount || 1,
      reward_value: rewardMaster?.coupon_masters?.coupon_code || 'game_clear_coupon',
      description: rewardMaster?.coupon_masters?.name || `ゲーム #${gameId} クリア報酬`,
      qr_data: qrData,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('報酬生成エラー:', error);
    return null;
  }

  return data;
};