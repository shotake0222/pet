/**
 * QRコード・ゲーム画面 - バグ修正と改善のまとめ
 */

# 🔧 修正内容

## 1️⃣ QRコード内容の改善

### 修正前
```
QRデータ = "REWARD_CODE:USER_ID"
→ スポット情報が含まれていない
```

### 修正後
```
QRデータ = "REWARD_CODE:USER_ID:SPOT_ID"（スポット指定時）
または
QRデータ = "REWARD_CODE:USER_ID"（スポット未指定時）

→ スポートごとに異なる商品提供が可能！
```

### 実装例

```typescript
// ゲームクリア時（gameUtils.ts）
const qrData = spotId 
  ? `${rewardCode}:${userId}:${spotId}` 
  : `${rewardCode}:${userId}`;
```

### QRデータをパース

```typescript
import { parseQRData, getSpotFromQRData } from '@/utils/spotManagementUtils';

// QRコード読み込み
const qrData = "ABC123-XYZ:user_id:spot_456";

// パース
const parsed = parseQRData(qrData);
console.log(parsed);
// { rewardCode: 'ABC123-XYZ', userId: 'user_id', spotId: 'spot_456' }

// スポット情報を取得
const spot = await getSpotFromQRData(qrData);
console.log(spot); // { name: '東京駅', ... }
```

### 商品交換時の実装例

```typescript
// 店舗側のQRスキャン処理
const handleQRScan = async (qrData: string) => {
  try {
    // 1. QRデータをパース
    const { rewardCode, spotId } = parseQRData(qrData);
    
    // 2. クーポンを検証
    const coupon = await verifyRewardCode(rewardCode);
    
    // 3. スポット情報を取得
    const spot = await getSpotFromQRData(qrData);
    
    // 4. スポット別に異なる商品を提供
    if (spot?.name === '東京駅') {
      // 東京駅限定商品
      await giveProduct('Tokyo_Station_Souvenir');
    } else if (spot?.name === '渋谷') {
      // 渋谷限定商品
      await giveProduct('Shibuya_Merchandise');
    }
    
    // 5. クーポンを使用済みに
    await useCoupon(coupon.id);
    
  } catch (error) {
    alert(`エラー: ${error.message}`);
  }
};
```

---

## 2️⃣ ゲーム画面の遷移バグ修正

### 問題点
```
ユーザーがゲーム中に少し移動
  ↓
GPS位置が更新
  ↓
スポット外と判定
  ↓
ゲーム画面が勝手に閉じる ❌
```

### 解決方法

**SpotDetector に `gameInProgress` フラグを追加**

```typescript
const [gameInProgress, setGameInProgress] = useState(false);

// ゲーム中は GPS チェックをスキップ
const checkNearbySpots = async (location) => {
  if (gameInProgress) {
    return; // ゲーム中は位置チェックをスキップ
  }
  
  // 通常のスポット検査...
};

// SpotGameView に フラグ設定コールバック
<SpotGameView
  onGameStart={() => setGameInProgress(true)}
  onGameEnd={() => setGameInProgress(false)}
/>
```

### 修正内容

**src/components/SpotDetector.tsx**
- `gameInProgress` フラグを追加
- ゲーム中はGPS追跡をスキップ
- `onGameStart/onGameEnd` コールバック追加

**src/components/SpotGameView.tsx**
- ゲーム開始時に `onGameStart()` を呼び出し
- ゲーム終了/キャンセル時に `onGameEnd()` を呼び出し
- `onCancel` 時に確実に `onGameEnd()` を実行

---

## 🔄 遷移フロー（修正後）

### 正常なフロー

```
[メイン画面]
   ↓ ユーザーがスポット到着
SpotDetector
   ↓ onGameStart() 呼び出し
gameInProgress = true
   ↓ GPS チェック一時停止
[ゲーム選択画面]
   ↓ ゲームをクリック
[ゲーム画面]
   ↓ ゲーム中は GPS チェック実行されない ✅
[ゲーム終了]
   ↓ onGameEnd() 呼び出し
gameInProgress = false
   ↓ GPS チェック再開
[メイン画面に戻る]
```

### キャンセル時のフロー

```
[ゲーム画面]
   ↓ キャンセルボタン
onGameEnd() 呼び出し
   ↓
gameInProgress = false
   ↓
selectedGame = null
   ↓
[ゲーム選択画面に戻る]
   ↓ スポット出発ボタン
onClose() 呼び出し
   ↓
[メイン画面に戻る]
```

---

## 📊 各コンポーネントの役割

| コンポーネント | 役割 | フラグ制御 |
|--------------|------|---------|
| **SpotDetector** | GPS監視・スポット検出 | `gameInProgress` で制御 |
| **SpotGameView** | ゲーム選択・管理 | `onGameStart/End` 発火 |
| **ClickerGame** 等 | ゲーム実行 | フラグは変更しない |

---

## ✅ テストチェックリスト

- [ ] スポット到着時にゲーム画面が表示される
- [ ] ゲーム中に移動してもゲーム画面が閉じない
- [ ] ゲーム中止時にメイン画面に戻れる
- [ ] ゲームをクリアできる
- [ ] クーポン画面にQRコードが表示される
- [ ] QRコードをスキャンできる
- [ ] スポット情報がQRに含まれている

---

## 🔗 使用可能な関数一覧

### QRコード関連

```typescript
// QRデータを生成
generateQRData(rewardCode, userId, spotId?)

// QRデータをパース
parseQRData(qrData) 
// → { rewardCode, userId, spotId? }

// QRデータからスポット取得
getSpotFromQRData(qrData)
// → { id, name, latitude, longitude, ... }

// クーポンを検証
verifyRewardCode(rewardCode)
// → クーポンデータ or エラー

// クーポンを使用済みに
useCoupon(rewardId)
```

### ゲーム関連

```typescript
// ゲームをクリア（報酬自動生成）
completeGame(userId, gameId, score, spotId)

// 利用可能なゲームを取得
getUnlockedGames(userId)

// スポット内かを判定
isUserAtSpot(userLat, userLng, spotLat, spotLng, radiusMeters)
```

---

## 🚀 今後の拡張案

### 1. テキストコード形式への変更
```typescript
// QRコードの代わりにテキストコードを表示
rewardCode = "TOKYO-2026-ABC123"
```

### 2. スポット限定商品の実装
```typescript
// 各スポットに紐づく商品リストを作成
spots.products = [
  { spotId: 1, product: '東京駅限定グッズ' },
  { spotId: 2, product: '渋谷限定マグカップ' },
];
```

### 3. キャンペーン機能
```typescript
// 期間限定スポットと期間限定商品をセット
campaign = {
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  spots: [1, 2, 3],
  products: ['Limited Edition', ...],
};
```

---

## 📝 注意事項

- **GPS精度**: ゲーム中の位置情報チェックは実行されないため、ユーザーがスポット外に出ても問題なし
- **QRコード形式**: `CODE:USER:SPOT` の順番は固定
- **有効期限**: デフォルト30日（カスタマイズ可能）

---

実装完了です！ゲーム画面の遷移も安定し、QRコードもスポット対応になりました。 🎉
