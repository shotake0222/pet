/**
 * スポット・報酬管理ユーティリティ
 */

import { createClient } from '@/utils/supabase/client';
import crypto from 'crypto';

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
  const startDate = spot.start_date ? new Date(spot.start_date) : null;
  const endDate = spot.end_date ? new Date(spot.end_date) : null;

  if (startDate && now < startDate) return false; // まだ開始していない
  if (endDate && now > endDate) return false; // 終了している

  return spot.status === 'active';
};

/**
 * スポットを作成
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

  const { data, error } = await supabase
    .from('spots')
    .insert({
      ...spotData,
      start_date: spotData.start_date?.toISOString(),
      end_date: spotData.end_date?.toISOString(),
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * スポットを更新
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

  const payload: any = { ...updates };
  if (updates.start_date !== undefined) {
    payload.start_date = updates.start_date?.toISOString() || null;
  }
  if (updates.end_date !== undefined) {
    payload.end_date = updates.end_date?.toISOString() || null;
  }

  const { data, error } = await supabase
    .from('spots')
    .update(payload)
    .eq('id', spotId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * スポットを削除
 */
export const deleteSpot = async (spotId: bigint) => {
  const supabase = createClient();

  const { error } = await supabase
    .from('spots')
    .delete()
    .eq('id', spotId);

  if (error) throw error;
};

/**
 * すべてのスポットを取得
 */
export const getAllSpots = async () => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * スポットの状態を取得（有効/無効/予定）
 */
export const getSpotStatus = (spot: any): 'active' | 'inactive' | 'pending' => {
  const now = new Date();
  const startDate = spot.start_date ? new Date(spot.start_date) : null;
  const endDate = spot.end_date ? new Date(spot.end_date) : null;

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
      .from('spots')
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
