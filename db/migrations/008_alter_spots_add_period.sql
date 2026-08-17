-- 008_alter_spots_add_period.sql
-- spots テーブルに出現期間を追加

ALTER TABLE public.spots
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active', -- 'active', 'inactive', 'scheduled'
ADD COLUMN IF NOT EXISTS is_limited_time BOOLEAN DEFAULT false;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_spots_status_dates ON public.spots (status, start_date, end_date);
