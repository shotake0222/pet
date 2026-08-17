/**
 * ゲームシステムの統合例
 * 
 * ホーム画面にSpotDetectorを統合するコード例です
 */

// -------- src/app/home/page.tsx に追加 --------

// 既存のimportに追加：
import { SpotDetector } from '@/components/SpotDetector';

// HomeARコンポーネント内で、sessionUserIdを取得した後に以下を追加：

function HomeAR() {
  // ... 既存のstate定義 ...
  
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  
  // ... 既存のuseEffect処理 ...
  
  return (
    <div className="...">
      {/* 既存のコンテンツ */}
      {/* ... */}
      
      {/* ゲームシステムを統合 */}
      {sessionUserId && (
        <div className="mt-4">
          <SpotDetector userId={sessionUserId} />
        </div>
      )}
    </div>
  );
}

// -------- 最小限の統合例 --------

// もし簡潔に統合したい場合は、スポット検証ロジックのみ使用：

import { getAvailableSpots, isUserAtSpot } from '@/utils/gameUtils';

useEffect(() => {
  if (!sessionUserId) return;
  
  // GPS位置情報を取得
  navigator.geolocation.watchPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    const nearbySpots = await getAvailableSpots(latitude, longitude);
    
    if (nearbySpots.length > 0) {
      console.log('近くのスポット:', nearbySpots);
      // ゲーム画面を表示
    }
  });
}, [sessionUserId]);
