/**
 * ゲームシステム - セットアップガイド
 * 
 * このガイドを参照して、ゲームシステムをセットアップしてください。
 */

# 🎮 ゲームシステムのセットアップガイド

## 1️⃣ データベースマイグレーション

### 実行順序：
```bash
# Supabase の SQL Editor で以下のファイルを順番に実行してください
db/migrations/004_create_spots.sql          # スポット管理テーブル
db/migrations/005_create_games.sql          # ゲームマスタテーブル
db/migrations/006_create_game_progress.sql  # ゲーム進捗テーブル
db/migrations/007_create_user_game_unlocks.sql  # アンロック状況テーブル
```

### または、セットアップスクリプトを実行：
```bash
# Supabase の SQL Editor で実行
db/setup_games.sql
```

## 2️⃣ ホーム画面にSpotDetectorを統合

### `src/app/home/page.tsx` に以下を追加：

```typescript
import { SpotDetector } from '@/components/SpotDetector';

// useEffect内で sessionUserIdを取得したら、以下を追加：
<SpotDetector userId={sessionUserId} />
```

## 3️⃣ ゲーム種別について

実装済みのゲーム：

| 種別 | 説明 | アンロック条件 | スコア計算 |
|------|------|--------------|---------|
| **clicker** | 30秒間タップゲーム | 最初からアンロック | タップ回数 |
| **puzzle** | マッチングパズル | 1クリア後 | 100 - (移動回数 × 5) |
| **rhythm** | リズムゲーム | 3クリア後 | ノーツ命中数 × 100 |

## 4️⃣ スポット管理方法

### Supabase管理画面から手動追加：

**テーブル**: `public.spots`

**必須カラム**：
- `name` (TEXT): スポット名
- `description` (TEXT): 説明
- `latitude` (NUMERIC): 緯度
- `longitude` (NUMERIC): 経度
- `radius_meters` (INTEGER): 到着判定半径（メートル）

### または、SQLで追加：

```sql
INSERT INTO public.spots (name, description, latitude, longitude, radius_meters)
VALUES
  ('スポット名', '説明', 緯度, 経度, 半径)
```

**日本の主要都市の座標例**：
- 東京駅: 35.6762, 139.7674
- 渋谷: 35.6595, 139.7004
- 大阪駅: 34.7330, 135.5020
- 京都駅: 34.7750, 135.7539

## 5️⃣ ゲームマスタの追加・編集

**テーブル**: `public.games`

```sql
INSERT INTO public.games 
  (title, description, game_type, difficulty, unlocked_by_clear_count, points_on_clear, display_order)
VALUES
  ('ゲームタイトル', '説明', 'game_type', 難易度, クリア条件, ポイント, 表示順);
```

**game_type** の種別：
- `clicker`: クリッカーゲーム
- `puzzle`: パズルゲーム
- `rhythm`: リズムゲーム

**difficulty** の値: 1-5 (⭐の数)

## 6️⃣ ユーザーの進捗確認

**テーブル**: `public.game_progress`

```sql
-- ユーザーのクリア数を確認
SELECT user_id, game_id, clear_count, best_score 
FROM public.game_progress 
WHERE user_id = 'user_id_here';
```

## 7️⃣ トラブルシューティング

### Q: ゲームがアンロックされない
→ `game_progress` テーブルで `clear_count` が正しく更新されているか確認してください

### Q: スポットに到着しても反応しない
→ 位置情報の許可を確認し、GPS精度を確認してください（正確性±5m必要）

### Q: 新しいゲームを追加したい
→ `games` テーブルに新規レコード追加 + コンポーネント作成 + SpotGameViewで対応ゲームタイプを処理

## 📱 モバイル対応

このシステムはSSL/HTTPSが必須です。ローカルホスト以外では自動的にHTTPSが強制されます。

位置情報取得時は必ず HTTPS が必要です。

## 🔐 セキュリティ上の注意

- ユーザーIDはSupabaseの認証済みユーザーのみが取得可能
- スポット座標も公開されるため、プライベートスポット登録には注意

---

**セットアップ完了後、ホーム画面で位置情報を許可してゲームをプレイしてください！**
