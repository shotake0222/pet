/**
 * デバッグモード・管理者モード用ユーティリティ
 */

import { createClient } from '@/utils/supabase/client';

/**
 * ユーザーがデバッグモード/管理者かを判定
 */
export const isDebugMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // ローカルストレージのフラグをチェック
  const debugFlag = localStorage.getItem('DEBUG_MODE');
  if (debugFlag === 'true') return true;
  
  // URLパラメータをチェック
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('debug') === 'true' || urlParams.get('admin') === 'true';
};

/**
 * ユーザーが管理者かを判定
 */
export const isAdmin = async (userId: string): Promise<boolean> => {
  if (isDebugMode()) return true; // デバッグモード時は常に管理者扱い
  
  const supabase = createClient();

  try {
    // クライアント側からは auth.users テーブルに直接アクセスできないため、
    // 現在ログインしているユーザーのセッション情報からメタデータを取得します。
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return false;
    
    // 判定対象のユーザーIDとログイン中のユーザーIDが一致するか確認
    if (user.id !== userId) return false;

    // user_metadata または app_metadata に role が admin として設定されているか
    return user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin';
  } catch (error) {
    console.error('管理者確認エラー:', error);
    return false;
  }
};

/**
 * デバッグモードを有効化（開発用）
 */
export const enableDebugMode = (e?: any) => {
  // イベントオブジェクトが渡された場合、デフォルトの挙動（フォーム送信など）をキャンセル
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  
  if (typeof window === 'undefined') return;

  // フラグの保存
  localStorage.setItem('DEBUG_MODE', 'true');

  // CONFIGの状態も同時に有効化しておく
  const config = getDebugModeConfig();
  config.isEnabled = true;
  localStorage.setItem('DEBUG_MODE_CONFIG', JSON.stringify(config));
  
  // 少し遅延させることで、フレームワークのルーティング干渉を防ぎ確実にリロードする
  setTimeout(() => {
    window.location.reload();
  }, 100);
};

/**
 * デバッグモードを無効化
 */
export const disableDebugMode = (e?: any) => {
  // イベントオブジェクトが渡された場合、デフォルトの挙動をキャンセル
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  if (typeof window === 'undefined') return;

  // フラグと設定の両方を確実に削除する
  localStorage.removeItem('DEBUG_MODE');
  localStorage.removeItem('DEBUG_MODE_CONFIG');
  
  // 少し遅延させて確実にリロード
  setTimeout(() => {
    window.location.reload();
  }, 100);
};

/**
 * デバッグ用：ゲームのアンロック条件を無視して全ゲームを返す
 */
export const getUnlockedGamesDebug = async (userId: string) => {
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

  // 各ゲーム：全てアンロック状態で返す
  return (allGames || []).map((game) => {
    const progress = (progressData || []).find((p) => p.game_id === game.id);

    return {
      ...game,
      progress: progress || { clear_count: 0, best_score: 0, last_played_at: null },
      isUnlocked: true, // 常にアンロック状態
    };
  });
};

/**
 * デバッグ用：クーポンを即座に生成（アイテム消費なし）
 */
export const createDebugCoupon = async (userId: string, gameId: bigint, spotId?: bigint | null) => {
  const supabase = createClient();

  const rewardCode = `DEBUG-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  
  // QRデータ生成
  const qrData = spotId 
    ? `${rewardCode}:${userId}:${spotId}` 
    : `${rewardCode}:${userId}`;

  // game_rewardsテーブルに直接追加（スコア無視）
  const { data, error } = await supabase
    .from('game_rewards')
    .insert({
      user_id: userId,
      game_id: gameId,
      spot_id: spotId || null,
      reward_code: rewardCode,
      reward_type: 'test_coupon',
      reward_value: 1,
      description: '[デバッグ] テストクーポン',
      qr_data: qrData,
      is_used: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日後
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * デバッグ用：全スポットへアクセス可能（位置チェック無視）
 */
export const getAvailableSpotsDebug = async (userLat: number, userLng: number) => {
  const supabase = createClient();

  // 全スポットを返す（位置チェック無し）
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .eq('status', 'active');

  if (error) throw error;
  return data || [];
};

/**
 * デバッグ用：位置情報チェックを無視して常にtrueを返す
 */
export const isUserAtSpotDebug = (_userLat: number, _userLng: number): boolean => {
  return true; // 常にスポット内と判定
};

/**
 * デバッグ用：UI制御パネル用の状態
 */
export interface DebugModeState {
  isEnabled: boolean;
  allowAllGames: boolean;
  ignoreLocation: boolean;
  autoCoupon: boolean;
  showDebugInfo: boolean;
}

/**
 * デバッグモード用の設定を保存
 */
export const setDebugModeConfig = (config: Partial<DebugModeState>) => {
  if (typeof window === 'undefined') return;
  const current = getDebugModeConfig();
  const updated = { ...current, ...config };
  localStorage.setItem('DEBUG_MODE_CONFIG', JSON.stringify(updated));
};

/**
 * デバッグモード用の設定を取得
 */
export const getDebugModeConfig = (): DebugModeState => {
  if (typeof window === 'undefined') {
    return {
      isEnabled: false,
      allowAllGames: true,
      ignoreLocation: true,
      autoCoupon: true,
      showDebugInfo: true,
    };
  }

  const config = localStorage.getItem('DEBUG_MODE_CONFIG');
  if (!config) {
    return {
      isEnabled: isDebugMode(),
      allowAllGames: true,
      ignoreLocation: true,
      autoCoupon: true,
      showDebugInfo: true,
    };
  }

  return JSON.parse(config);
};