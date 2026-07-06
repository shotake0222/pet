'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// 2点間の距離をメートルで計算する関数（Haversineの公式）
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // 地球の半径 (メートル)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // メートルで返す
}

export default function HomeAR() {
  const searchParams = useSearchParams();
  const tagCode = searchParams.get('tag');
  const supabase = createClient();
  
  const [viewMode, setViewMode] = useState<'mindar' | 'gps' | 'report'>('mindar');
  const [isClient, setIsClient] = useState(false);
  
  // ユーザー・ペット情報
  const [petId, setPetId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [affection, setAffection] = useState(0);

  // GPS・ランドマーク関連State
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [activeLandmark, setActiveLandmark] = useState<any | null>(null);

  useEffect(() => { setIsClient(true); }, []);

  // --- 1. [初期ロード] ペット情報とランドマークマスターの取得 ---
  useEffect(() => {
    const fetchData = async () => {
      if (!tagCode) return;
      // ペット情報の取得
      const { data: pet } = await supabase
        .from('pets')
        .select('id, owner_id, affection_level, nfc_tags!inner(tag_code)')
        .eq('nfc_tags.tag_code', tagCode)
        .single();
      if (pet) {
        setPetId(pet.id);
        setOwnerId(pet.owner_id);
        setAffection(pet.affection_level || 0);
      }
      // ランドマーク（スポット）一覧の取得
      const { data: spots } = await supabase.from('landmarks').select('*');
      if (spots) setLandmarks(spots);
    };
    fetchData();
  }, [tagCode, supabase]);

  // --- 2. [GPSモード] 歩行に合わせたリアルタイム位置取得 ---
  useEffect(() => {
    if (viewMode === 'gps' && navigator.geolocation) {
      // watchPositionを使うことで、歩くたびに現在地が更新されます
      const watchId = navigator.geolocation.watchPosition(
        (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => console.error("位置情報の取得に失敗しました", error),
        { enableHighAccuracy: true, maximumAge: 0 } // 常に最新のGPSを要求
      );
      // モードが切り替わったらGPS監視を停止（バッテリー節約）
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [viewMode]);

  // --- 3. [GPSモード] ランドマークへの接近判定 ---
  useEffect(() => {
    if (viewMode === 'gps' && location && landmarks.length > 0) {
      // 登録されている全スポットと現在地の距離を計算
      const nearbySpot = landmarks.find(lm => {
        const distance = getDistance(location.lat, location.lng, lm.latitude, lm.longitude);
        return distance <= lm.radius_meters; // 設定した半径(例:50m)以内に入ったか
      });
      setActiveLandmark(nearbySpot || null);
    }
  }, [location, landmarks, viewMode]);

  // --- 4. [アクション] スポットにチェックイン（ポイントGET） ---
  const handleCheckIn = async () => {
    if (!activeLandmark || !petId || !ownerId) return;

    // 「今日」の日付文字列を作成 (例: "2023-10-01")
    const today = new Date().toLocaleDateString('sv-SE'); 

    // A. landmark_visitsに記録（※DBのUNIQUE制約により、同日同場所はここで弾かれます）
    const { error: visitError } = await supabase
      .from('landmark_visits')
      .insert({
        user_id: ownerId,
        landmark_id: activeLandmark.id,
        visited_date: today
      });

    if (visitError) {
      alert('今日は既にこのスポットでポイントを獲得済みです！明日また来ましょう。');
      return;
    }

    // B. 初訪問だった場合、ログに記録（ポイント獲得）
    await supabase.from('activity_logs').insert({
      pet_id: petId,
      action_type: 'landmark_visit',
      points_earned: activeLandmark.bonus_points
    });

    alert(`🎉 ${activeLandmark.name} にチェックイン！\n${activeLandmark.bonus_points} ポイント獲得しました！`);
  };

  // --- MindARのタップイベント等は前回コードと同等のため省略(実装済として扱う) ---
  // ...

  if (!isClient) return <div className="bg-black w-full h-screen"></div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <Script src="https://aframe.io/releases/1.5.0/aframe.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js" strategy="beforeInteractive" />
      <Script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar-nft.js" strategy="beforeInteractive" />

      {/* --- 前面：React UIレイヤー --- */}
      <div className="absolute z-10 bottom-0 w-full p-4 flex flex-col gap-4 pointer-events-auto">
        
        {/* GPSモード専用UI */}
        {viewMode === 'gps' && (
          <>
            <div className="bg-green-600/90 text-white p-3 rounded-xl font-bold shadow-lg w-full text-center text-sm">
              {location ? '🚶‍♂️ 現在地周辺を散歩中...' : '📡 GPSを探索中...'}
            </div>

            {/* ランドマークに接近した時だけ出現する特別なボタン */}
            {activeLandmark && (
              <button 
                onClick={handleCheckIn} 
                className="bg-yellow-400 text-black p-4 rounded-xl font-bold shadow-2xl w-full border-4 border-yellow-200 animate-bounce"
              >
                ✨ 【{activeLandmark.name}】を発見！<br/>タップしてポイントGET！
              </button>
            )}
          </>
        )}

        <div className="flex justify-around bg-white p-3 rounded-2xl shadow-xl">
          <button onClick={() => setViewMode('mindar')} className={`font-bold ${viewMode === 'mindar' ? 'text-blue-600' : 'text-gray-400'}`}>🏠 おうち</button>
          <button onClick={() => setViewMode('gps')} className={`font-bold ${viewMode === 'gps' ? 'text-green-600' : 'text-gray-400'}`}>🚶 さんぽ</button>
          <button onClick={() => setViewMode('report')} className={`font-bold ${viewMode === 'report' ? 'text-purple-600' : 'text-gray-400'}`}>📊 記録</button>
        </div>
      </div>

      {/* --- 背面：ARレイヤー --- */}
      <div className="absolute top-0 left-0 w-full h-full z-0">
        
        {/* 手元モード (MindAR) は省略せず維持してください */}

        {/* --- 風景モード (GPS AR) --- */}
        {viewMode === 'gps' && location && (
          /* @ts-ignore */
          <a-scene vr-mode-ui="enabled: false" arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false;">
            {/* @ts-ignore */}
            <a-assets>
              {/* @ts-ignore */}
              <a-asset-item id="pet-asset-gps" src="/models/pet.glb"></a-asset-item>
              {/* 特別なスポットに到達した時に出現するオブジェクト（宝箱やクリスタルなど） */}
              {/* @ts-ignore */}
              <a-asset-item id="landmark-asset" src="/models/treasure.glb"></a-asset-item>
            </a-assets>
            {/* @ts-ignore */}
            <a-camera gps-camera rotation-reader></a-camera>

            {/* 一緒に歩くペット */}
            {/* @ts-ignore */}
            <a-entity gps-entity-place={`latitude: ${location.lat}; longitude: ${location.lng};`} gltf-model="#pet-asset-gps" scale="2 2 2" position="0 -2 0" look-at="[gps-camera]"></a-entity>
            
            {/* ランドマークに接近した場合、風景の中に特別オブジェクトを出没させる */}
            {activeLandmark && (
              /* @ts-ignore */
              <a-entity
                gps-entity-place={`latitude: ${activeLandmark.latitude}; longitude: ${activeLandmark.longitude};`}
                gltf-model="#landmark-asset"
                scale="5 5 5"
                position="0 2 0"
                animation="property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear;" /* くるくる回るアニメーション */
              ></a-entity>
            )}
          </a-scene>
        )}
      </div>
    </div>
  );
}