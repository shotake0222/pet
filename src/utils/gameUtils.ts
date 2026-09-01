/**
 * スポット検証・ゲーム管理ユーティリティ
 */

import { createClient } from '@/utils/supabase/client';

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
 */
export const getAvailableSpots = async (
  userLat: number,
  userLng: number,
  searchRadiusKm: number = 5,
  isDebugMode: boolean = false
) => {
  const supabase = createClient();

  const now = new Date().toISOString();

  // デバッグモード：位置チェック無視
  if (isDebugMode) {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      // 期間フィルタリング：start_time is null OR start_time <= now
      .or(`start_time.is.null,start_time.lte.${now}`)
      // 期間フィルタリング：end_time is null OR end_time >= now
      .or(`end_time.is.null,end_time.gte.${now}`);
    
    if (error) throw error;
    return data || [];
  }

  const latOffset = searchRadiusKm / 111; // 1度 ≈ 111km
  const lngOffset = searchRadiusKm / (111 * Math.cos((userLat * Math.PI) / 180));

  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .gte('latitude', userLat - latOffset)
    .lte('latitude', userLat + latOffset)
    .gte('longitude', userLng - lngOffset)
    .lte('longitude', userLng + lngOffset)
    // 🚨 期間フィルタリング：start_time is null OR start_time <= now
    .or(`start_time.is.null,start_time.lte.${now}`)
    // 🚨 期間フィルタリング：end_time is null OR end_time >= now
    .or(`end_time.is.null,end_time.gte.${now}`);

  if (error) throw error;

  // 詳密な距離計算でフィルター
  return (data || []).filter((spot) =>
    isUserAtSpot(userLat, userLng, Number(spot.latitude), Number(spot.longitude), spot.radius_meters)
  );
};

/**
 * ユーザーのゲーム進捗を取得
 */
export const getUserGameProgress = async (userId: string, gameId: bigint) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

  return data || null;
};

/**
 * アンロック可能なゲーム一覧を取得
 */
export const getUnlockedGames = async (userId: string, isDebugMode: boolean = false) => {
  const supabase = createClient();

  // すべてのゲーム取得
  const { data: allGames, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (gamesError) throw gamesError;

  // ユーザーの進捗取得
  const { data: progressData, error: progressError } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId);

  if (progressError) throw progressError;

  // 総クリア数計算
  const totalClears = (progressData || []).reduce((sum, p) => sum + p.clear_count, 0);

  // 各ゲームがアンロック可能か判定
  return (allGames || []).map((game) => {
    const progress = (progressData || []).find((p) => p.game_id === game.id);
    // デバッグモード時は全ゲームアンロック
    const isUnlocked = isDebugMode ? true : totalClears >= game.unlocked_by_clear_count;

    return {
      ...game,
      progress: progress || { clear_count: 0, best_score: 0, last_played_at: null },
      isUnlocked,
    };
  });
};

/**
 * ゲームをクリア（報酬生成機能付き）
 */
export const completeGame = async (
  userId: string,
  gameId: bigint,
  score: number = 0,
  spotId?: bigint | null
) => {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .single();

  if (existing) {
    // 既存レコード更新
    await supabase
      .from('game_progress')
      .update({
        clear_count: existing.clear_count + 1,
        best_score: Math.max(existing.best_score || 0, score),
        last_played_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // 新規レコード作成
    await supabase.from('game_progress').insert({
      user_id: userId,
      game_id: gameId,
      clear_count: 1,
      best_score: score,
      last_played_at: new Date().toISOString(),
    });
  }

  // クリア数に応じてゲームをアンロック
  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .eq('is_active', true);

  const { data: progressData } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', userId);

  const totalClears = (progressData || []).reduce((sum, p) => sum + p.clear_count, 0) + 1;

  // アンロック対象のゲームを探す
  const gamesToUnlock = (allGames || []).filter((g) => g.unlocked_by_clear_count <= totalClears);

  for (const game of gamesToUnlock) {
    const { data: alreadyUnlocked } = await supabase
      .from('user_game_unlocks')
      .select('*')
      .eq('user_id', userId)
      .eq('game_id', game.id)
      .single();

    if (!alreadyUnlocked) {
      await supabase.from('user_game_unlocks').insert({
        user_id: userId,
        game_id: game.id,
      });
    }
  }

  // 🎁 報酬を自動生成
  await createGameReward(userId, gameId, spotId);
};

/**
 * ゲームクリア報酬を生成
 */
export const createGameReward = async (
  userId: string,
  gameId: bigint,
  spotId?: bigint | null
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
      spot_id: spotId || null,
      reward_code: rewardCode,
      reward_type: 'coupon',
      reward_value: 'game_clear_coupon',
      description: `ゲーム #${gameId} クリア報酬`,
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
