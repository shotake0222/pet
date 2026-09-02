/**
 * スポット・報酬管理ユーティリティ
 */

import { createClient } from '@/utils/supabase/client';
// import crypto from 'crypto'; // 必要な場合はコメントアウトを外してください

/**
 * ユニークなリワードコードを生成
 */
export const generateRewardCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${timestamp}-${random}`;
};

/**
 * QRコード用のデータを生成
 * @param rewardCode - リワードコード
 * @param userId - ユーザーID
 * @param spotId - スポットID（オプション）
 * @returns QRコード化するデータ
 */
export const generateQRData = (rewardCode: string, userId: string, spotId?: bigint | null): string => {
  if (spotId) {
    return `${rewardCode}:${userId}:${spotId}`;
  }
  return `${rewardCode}:${userId}`;
};

/**
 * ゲームクリア時に報酬を生成
 */
export const createGameReward = async (
  userId: string,
  gameId: bigint,
  spotId: bigint | null,
  rewardType: 'coupon' | 'item' | 'points' = 'coupon',
  rewardValue?: string,
  description?: string,
  expiresAt?: Date
) => {
  const supabase = createClient();
  const rewardCode = generateRewardCode();
  const qrData = generateQRData(rewardCode, userId);

  const { data, error } = await supabase
    .from('game_rewards')
    .insert({
      user_id: userId,
      game_id: gameId,
      spot_id: spotId,
      reward_code: rewardCode,
      reward_type: rewardType,
      reward_value: rewardValue || 'standard',
      description: description || `ゲーム #${gameId} クリア報酬`,
      qr_data: qrData,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * スポットの有効性をチェック
 */
export const isSpotActive = (spot: any): boolean => {
  const now = new Date();
  // 修正: DBのカラム名に合わせて start_time / end_time を参照
  const startDate = spot.start_time ? new Date(spot.start_time) : null;
  const endDate = spot.end_time ? new Date(spot.end_time) : null;

  if (startDate && now < startDate) return false; // まだ開始していない
  if (endDate && now > endDate) return false; // 終了している

  // 修正: DBのステータスが未設定(null)の場合も有効とみなす
  return spot.status === 'active' || spot.status == null;
};

/**
 * スポット（ランドマーク）を作成
 * 🔧 landmarks テーブルに統一
 */
export const createSpot = async (spotData: {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  start_date?: Date;
  end_date?: Date;
  is_limited_time?: boolean;
}) => {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('landmarks')
      .insert({
        name: spotData.name,
        description: spotData.description,
        latitude: spotData.latitude,
        longitude: spotData.longitude,
        radius_meters: spotData.radius_meters,
        start_time: spotData.start_date?.toISOString() || null,
        end_time: spotData.end_date?.toISOString() || null,
        is_limited_time: spotData.is_limited_time || false,
        status: 'active', // 修正: 新規作成時はデフォルトでactiveにする
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('❌ createSpot error:', err);
    throw err;
  }
};

/**
 * スポット（ランドマーク）を更新
 * 🔧 landmarks テーブルに統一
 */
export const updateSpot = async (
  spotId: bigint,
  updates: {
    name?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    start_date?: Date | null;
    end_date?: Date | null;
    status?: 'active' | 'inactive' | 'scheduled';
    is_limited_time?: boolean;
  }
) => {
  const supabase = createClient();

  try {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.radius_meters !== undefined) payload.radius_meters = updates.radius_meters;
    if (updates.start_date !== undefined) payload.start_time = updates.start_date?.toISOString() || null;
    if (updates.end_date !== undefined) payload.end_time = updates.end_date?.toISOString() || null;
    if (updates.is_limited_time !== undefined) payload.is_limited_time = updates.is_limited_time;
    // 修正: statusの更新処理を追加
    if (updates.status !== undefined) payload.status = updates.status;

    const { data, error } = await supabase
      .from('landmarks')
      .update(payload)
      .eq('id', spotId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('❌ updateSpot error:', err);
    throw err;
  }
};

/**
 * スポット（ランドマーク）を削除
 * 🔧 landmarks テーブルに統一
 */
export const deleteSpot = async (spotId: bigint) => {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('landmarks')
      .delete()
      .eq('id', spotId);

    if (error) throw error;
  } catch (err: any) {
    console.error('❌ deleteSpot error:', err);
    throw err;
  }
};

/**
 * すべてのスポット（ランドマーク）を取得
 * 🔧 spots テーブルではなく landmarks テーブルから取得（統一）
 */
export const getAllSpots = async () => {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('landmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ getAllSpots error:', error);
      throw error;
    }
    return data || [];
  } catch (err: any) {
    console.error('❌ getAllSpots exception:', err);
    throw err;
  }
};

/**
 * スポットの状態を取得（有効/無効/予定）
 */
export const getSpotStatus = (spot: any): 'active' | 'inactive' | 'pending' => {
  const now = new Date();
  // 修正: DBのカラム名に合わせて start_time / end_time を参照
  const startDate = spot.start_time ? new Date(spot.start_time) : null;
  const endDate = spot.end_time ? new Date(spot.end_time) : null;

  if (startDate && now < startDate) return 'pending';
  if (endDate && now > endDate) return 'inactive';
  if (spot.status === 'inactive') return 'inactive';

  return 'active';
};

/**
 * ユーザーのクーポンを取得
 */
export const getUserCoupons = async (userId: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_rewards')
    .select('*')
    .eq('user_id', userId)
    .eq('is_used', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * クーポンを使用
 */
export const useCoupon = async (rewardId: bigint) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_rewards')
    .update({
      is_used: true,
      used_at: new Date().toISOString(),
    })
    .eq('id', rewardId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 報酬コードで検証（QRスキャン時用）
 */
export const verifyRewardCode = async (rewardCode: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_rewards')
    .select('*')
    .eq('reward_code', rewardCode)
    .single();

  if (error) throw error;
  if (!data) return null;

  // 期限チェック
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('このクーポンは有効期限切れです');
  }

  if (data.is_used) {
    throw new Error('このクーポンはすでに使用済みです');
  }

  return data;
};

/**
 * QRデータをパースしてスポット情報を抽出
 * @param qrData - QRコードから読み込んだデータ（例：CODE:USER_ID:SPOT_ID）
 * @returns { rewardCode, userId, spotId? }
 */
export const parseQRData = (qrData: string): { rewardCode: string; userId: string; spotId?: string } => {
  const parts = qrData.split(':');

  if (parts.length < 2) {
    throw new Error('無効なQRコード形式です');
  }

  return {
    rewardCode: parts[0],
    userId: parts[1],
    spotId: parts[2], // オプション
  };
};

/**
 * QRデータからスポット情報を取得
 */
export const getSpotFromQRData = async (qrData: string) => {
  try {
    const parsed = parseQRData(qrData);

    if (!parsed.spotId) {
      return null; // スポット情報が含まれていない
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('landmarks') // 修正: 'spots' テーブルから 'landmarks' テーブルへ変更
      .select('*')
      .eq('id', parsed.spotId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('スポット取得エラー:', error);
    return null;
  }
};