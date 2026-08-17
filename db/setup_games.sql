/**
 * ゲームシステムのセットアップファイル
 * Supabase の SQL Editor で実行してください
 * 
 * このスクリプトは以下を行います：
 * 1. サンプルゲームマスタを挿入
 * 2. サンプルスポットを挿入
 */

-- ================================
-- ゲームマスタデータ挿入
-- ================================
INSERT INTO public.games (title, description, game_type, difficulty, unlocked_by_clear_count, points_on_clear, display_order, is_active)
VALUES
  (
    'クリッカーチャレンジ',
    '30秒間でできるだけ多くタップしよう！',
    'clicker',
    1,
    0,
    100,
    1,
    true
  ),
  (
    'マッチングパズル',
    '同じ色のタイルをすべてマッチさせる',
    'puzzle',
    2,
    1,
    150,
    2,
    true
  ),
  (
    'リズムマスター',
    'A, S, D, F キーでノーツをヒット',
    'rhythm',
    3,
    3,
    200,
    3,
    true
  )
ON CONFLICT DO NOTHING;

-- ================================
-- スポットデータ挿入（サンプル）
-- ================================
-- 東京駅周辺
INSERT INTO public.spots (name, description, latitude, longitude, radius_meters, created_at)
VALUES
  (
    '東京駅',
    '東京の玄関口。たくさんのお店やレストラン',
    35.6762,
    139.7674,
    200,
    now()
  )
ON CONFLICT DO NOTHING;

-- 渋谷スクランブル交差点
INSERT INTO public.spots (name, description, latitude, longitude, radius_meters, created_at)
VALUES
  (
    '渋谷スクランブル交差点',
    '世界的に有名な交差点。カフェが多数',
    35.6595,
    139.7004,
    150,
    now()
  )
ON CONFLICT DO NOTHING;

-- 浅草寺
INSERT INTO public.spots (name, description, latitude, longitude, radius_meters, created_at)
VALUES
  (
    '浅草寺',
    '江戸情緒あふれるスポット。門前町が充実',
    35.7149,
    139.7955,
    250,
    now()
  )
ON CONFLICT DO NOTHING;

-- 銀座
INSERT INTO public.spots (name, description, latitude, longitude, radius_meters, created_at)
VALUES
  (
    '銀座',
    '高級ショッピングと飲食が集中',
    35.6745,
    139.7713,
    300,
    now()
  )
ON CONFLICT DO NOTHING;
