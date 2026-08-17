/**
 * スポット・報酬システム - Admin画面とユーザー画面の統合ガイド
 */

# 🎮 スポット・報酬システム完全ガイド

## 📋 実装内容

### ✅ DB スキーマ追加
- `spots` テーブル: 期間情報 (`start_date`, `end_date`, `status`, `is_limited_time`)
- `game_rewards` テーブル: クーポン・報酬 (QRコード、有効期限、使用状況)

### ✅ Admin 管理画面
- **🎮 スポット管理タブ**: 
  - スポット作成・編集・削除
  - 期間限定スポット設定
  - 地図座標の管理
  - 検出半径設定

- **🎁 報酬管理タブ**:
  - クーポン一覧表示
  - QRコード表示
  - 使用状況管理
  - 期限管理

### ✅ ユーザー画面
- **マイクーポン表示**:
  - クーポン一覧
  - QRコード表示・ダウンロード
  - 使用状況確認
  - 有効期限表示

### ✅ 自動報酬生成
- ゲームクリア時に自動でクーポンを生成
- QRコード自動生成
- 30日の有効期限を自動設定

---

## 🚀 セットアップ手順

### 1️⃣ DB マイグレーション実行

Supabase の **SQL Editor** で以下のファイルを実行：

```sql
-- db/migrations/008_alter_spots_add_period.sql を実行
ALTER TABLE public.spots
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_limited_time BOOLEAN DEFAULT false;

-- db/migrations/009_create_game_rewards.sql を実行
CREATE TABLE IF NOT EXISTS public.game_rewards (
  ...
);
```

### 2️⃣ npm依存関係を更新

```bash
npm install qrcode
```

### 3️⃣ Admin画面の確認

1. Admin画面を開く
2. 新しいタブが表示：
   - **🎮 スポット管理** - スポットの作成・編集・削除
   - **🎁 報酬管理** - クーポンとQRコードの管理

---

## 📱 スポット管理（Admin画面）

### スポット追加フロー

```
🎮 スポット管理タブ
  ↓
📝 スポット名を入力
  ↓
📍 座標を設定（緯度・経度）
  ↓
📏 検出半径を設定（デフォルト100m）
  ↓
⏰ 期間を設定（期間限定の場合のみ）
  ↓
💾 作成ボタンをクリック
```

### 期間限定スポットの設定

**チェックボックス: 「期間限定スポット」**

有効にすると以下が設定可能：

- **開始日時**: スポットが有効になる日時
- **終了日時**: スポットが無効になる日時

期限外のスポットは自動で非表示になります。

### スポットステータス

| ステータス | 説明 | 表示 |
|-----------|------|------|
| **有効** | 現在利用可能 | 🟢 スポット利用可能 |
| **予定** | 開始日時前 | 🟡 まだ開始されていない |
| **無効** | 終了日時過ぎ | 🔴 終了済み |

---

## 🎁 報酬・クーポンシステム

### クリア時の自動報酬生成

ユーザーがスポットでゲームをクリアすると：

```
1. ゲームクリア
   ↓
2. 報酬コード自動生成
   ↓
3. QRコード自動生成
   ↓
4. 有効期限設定（デフォルト30日）
   ↓
5. game_rewards テーブルに保存
   ↓
6. ユーザーのマイクーポンに表示
```

### クーポンの構成

```
{
  reward_code: "ABC1234-XYZ789"    // ユニークなコード
  qr_data: "ABC1234-XYZ789:user_id" // QRコード化データ
  reward_type: "coupon"
  description: "ゲーム #1 クリア報酬"
  is_used: false
  expires_at: "2026-09-16"
}
```

### Admin画面でのクーポン管理

#### 一覧表示

- **未使用**: アクティブなクーポン
- **使用済み**: 既に使用されたクーポン  
- **期限切れ**: 有効期限切れ

#### 各クーポンの表示内容

- 🔍 QRコード画像
- 💬 説明
- 👤 発行ユーザーID
- 🎮 対応ゲームID
- 📅 発行日時・使用日時
- ⏰ 有効期限

#### アクション

- **使用済みボタン**: クーポンを使用済みに変更
- **削除ボタン**: クーポンをデータベースから削除

---

## 👤 ユーザー側：マイクーポン画面

### 組み込み方法

```typescript
// ホーム画面などに組み込む
import { UserCouponView } from '@/components/UserCouponView';

<UserCouponView userId={sessionUserId} />
```

### ユーザー画面の機能

#### クーポン一覧表示

```
🎁 マイクーポン
  ├─ 📋 「有効」タブ: 使用可能なクーポン
  ├─ 📋 「期限切れ」タブ: 有効期限切れ
  └─ 📋 「すべて」タブ: 全クーポン
```

#### QRコード表示

クーポンをタップすると：

1. QRコード画面に遷移
2. 大型のQRコード表示
3. クーポンコード表示
4. クーポン詳細情報

#### 使用フロー

```
マイクーポン
  ↓
クーポンをタップ
  ↓
QRコード画面表示
  ↓
店舗でQRコードをスキャン
  ↓
「このクーポンを使用」ボタン
  ↓
使用済みに変更
  ↓
「期限切れ」タブに移動
```

---

## 🔗 データフロー全体

```
[ユーザー]
   ↓
[スポット到着]
   ↓
[ゲームプレイ]
   ↓
[ゲームクリア]
   ↓ completeGame()
[報酬自動生成] ← game_rewards テーブルにINSERT
   ↓
[QRコード自動生成]
   ↓
[マイクーポンに表示]
   ↓
[ユーザーが確認・使用]
   ↓ useCoupon()
[店舗でQRスキャン]
   ↓
[実商品と交換]
```

---

## 📍 日本主要都市の座標例

スポット追加時に参考にしてください：

```
東京駅:        35.6762, 139.7674
渋谷スクランブル: 35.6595, 139.7004
浅草寺:        35.7149, 139.7955
銀座:          35.6745, 139.7713
大阪駅:        34.7330, 135.5020
京都駅:        34.7750, 135.7539
福岡天神:      33.5904, 130.4017
```

---

## 🔐 セキュリティ上の注意

### ユーザーIDの保護
- クーポンには発行したユーザーのIDが紐づく
- Admin画面では初期8文字のみ表示

### QRコードのバリデーション
- スキャン時に `verifyRewardCode()` で検証
- 使用済み・期限切れは使用不可

### 商品交換の実装例

```typescript
// 店舗システムでのスキャン処理
const handleQRScan = async (qrData: string) => {
  try {
    const coupon = await verifyRewardCode(qrData);
    
    if (!coupon) {
      alert('このクーポンは見つかりません');
      return;
    }
    
    // 実商品と交換
    await exchangeForProduct(coupon);
    
  } catch (error) {
    alert(`エラー: ${error.message}`);
  }
};
```

---

## 🐛 トラブルシューティング

### Q: スポットが検出されない
→ GPS精度確認、スポットの座標・半径を見直す

### Q: QRコード生成エラー
→ `qrcode` パッケージが正しくインストールされているか確認

### Q: クーポンが自動生成されない  
→ `gameUtils.ts` の `completeGame()` が報酬生成処理を呼んでいるか確認

### Q: Admin画面に新タブが表示されない
→ ブラウザキャッシュをクリア、ページをリロード

---

## 📝 カスタマイズ例

### クーポンの有効期限を変更

```typescript
// src/utils/spotManagementUtils.ts の createGameReward()
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 60); // 60日に変更
```

### 報酬タイプを増やす

```typescript
// game_rewards テーブルの reward_type を拡張
- 'coupon'   → クーポン
- 'item'     → アイテム
- 'points'   → ポイント
- 'voucher'  → バウチャー（新規）
```

### QRコードの内容をカスタマイズ

```typescript
// generateQRData() 関数を編集
const qrData = `https://pet.example.com/coupon/${rewardCode}`;
```

---

## 🎯 次のステップ

1. ✅ DB マイグレーション実行
2. ✅ npm パッケージ更新
3. ✅ Admin 画面で最初のスポット作成
4. ✅ ユーザー側にマイクーポン画面を組み込む
5. ✅ GPS テスト
6. ✅ 実商品交換フローの実装

---

**システムは完全に実装済みです。Admin画面で管理を開始できます！** 🚀
