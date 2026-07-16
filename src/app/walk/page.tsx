'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const playSound = (type: 'tap' | 'eat' | 'hatch' | 'levelup' | 'item' | 'error' | 'camera') => {
  const audio = new Audio(`/sounds/${type}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function WalkAR() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [isClient, setIsClient] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [isEgg, setIsEgg] = useState(true);
  const [walkDistance, setWalkDistance] = useState(0);
  const [feedCount, setFeedCount] = useState(0);
  const [landmarkVisitCount, setLandmarkVisitCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [exp, setExp] = useState(0);
  const [affection, setAffection] = useState(0);
  
  const [petMasterName, setPetMasterName] = useState<string>('');
  const [customName, setCustomName] = useState<string | null>(null);
  const [petCondition, setPetCondition] = useState<'healthy' | 'sick' | 'starving'>('healthy');
  const [hungerPercent, setHungerPercent] = useState(100);
  const [motivationPercent, setMotivationPercent] = useState(100);
  const [sleepingUntil, setSleepingUntil] = useState<string | null>(null);
  const [lastFedAt, setLastFedAt] = useState<string | null>(null);
  
  const [petModelUrlV1, setPetModelUrlV1] = useState<string>('');
  const [petModelUrlV2, setPetModelUrlV2] = useState<string | null>(null);
  const [petModelUrlV3, setPetModelUrlV3] = useState<string | null>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prevLocation, setPrevLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [activeLandmark, setActiveLandmark] = useState<any | null>(null);
  const [isSpotMapOpen, setIsSpotMapOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [sceneKey, setSceneKey] = useState(0);

  const lastEncounterTime = useRef(0);
  const stepCount = Math.floor(walkDistance / 0.75);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setSessionUserId(session.user.id);
      setIsAuthChecking(false);
    };
    initAuth();
  }, [supabase, router]); 

  useEffect(() => {
    const fetchGameData = async () => {
      if (!sessionUserId) return;

      const { data: spots } = await supabase.from('landmarks').select('*, landmark_masters(facility_type)');
      if (spots) setLandmarks(spots);

      const { data: pet } = await supabase.from('pets')
        .select(`id, affection_level, sleeping_until, last_fed_at, is_egg, walk_distance_m, level, exp, custom_name, condition_status, is_deceased, pet_masters(name, model_url, model_url_v2, model_url_v3)`)
        .eq('owner_id', sessionUserId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (pet && !pet.is_deceased) {
        setPetId(pet.id); setAffection(pet.affection_level || 0); 
        setSleepingUntil(pet.sleeping_until); setLastFedAt(pet.last_fed_at); 
        setIsEgg(pet.is_egg); setWalkDistance(pet.walk_distance_m || 0); setLevel(pet.level || 1);
        setExp(pet.exp || 0); setCustomName(pet.custom_name); 
        setPetCondition((pet.condition_status || 'healthy') as any);

        if (pet.pet_masters) {
          const pm = (pet.pet_masters && pet.pet_masters[0] ? pet.pet_masters[0] : pet.pet_masters) || {};
          setPetModelUrlV1((pm as any).model_url || '');
          setPetModelUrlV2((pm as any).model_url_v2 || null);
          setPetModelUrlV3((pm as any).model_url_v3 || null);
          setPetMasterName((pm as any).name || '不明');
        }

        const { count: feedLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'feed');
        if (feedLogCount !== null) setFeedCount(feedLogCount);
        const { count: eventLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'event');
        if (eventLogCount !== null) setEventCount(eventLogCount);
        const { count: landmarkCount } = await supabase.from('landmark_visits').select('id', { count: 'exact', head: true }).eq('user_id', sessionUserId);
        if (landmarkCount !== null) setLandmarkVisitCount(landmarkCount);
      }
      setIsDataLoaded(true);
    };
    fetchGameData();
  }, [sessionUserId, supabase]);

  const activeModelUrl = level >= 10 ? petModelUrlV3 : (level >= 5 ? petModelUrlV2 : petModelUrlV1);
  const isSleeping = sleepingUntil ? new Date(sleepingUntil) > new Date() : false;
  const displayName = customName || petMasterName || '名無し';

  useEffect(() => {
    if (!lastFedAt || isEgg) return;
    const calculateStatus = () => {
      const now = new Date().getTime(); const lastFedTime = new Date(lastFedAt).getTime();
      const hoursPassed = (now - lastFedTime) / (1000 * 60 * 60);
      let calculatedHunger = 100 - (hoursPassed / 24) * 100;
      if (isSleeping) calculatedHunger = Math.max(calculatedHunger, 50);
      const finalHunger = Math.max(0, Math.min(100, Math.floor(calculatedHunger)));
      setHungerPercent(finalHunger);

      let baseMotivation = 50 + (affection * 2);
      if (finalHunger < 50 && !isSleeping) baseMotivation -= (50 - finalHunger) * 2;
      if (isSleeping) baseMotivation = 100;
      setMotivationPercent(Math.max(0, Math.min(100, Math.floor(baseMotivation))));
    };
    calculateStatus();
    const interval = setInterval(calculateStatus, 60000);
    return () => clearInterval(interval);
  }, [lastFedAt, affection, isEgg, isSleeping]);

  const triggerEncounter = async () => {
    if (!sessionUserId) return;
    const now = Date.now();
    if (now - lastEncounterTime.current < 300000) return;
    lastEncounterTime.current = now;

    try {
      let { data: item } = await supabase.from('item_masters').select('id').eq('name', 'ぺたるの香り').maybeSingle();
      if (item) {
        const { data: inventoryItem } = await supabase.from('user_inventory').select('id, quantity').eq('user_id', sessionUserId).eq('item_id', item.id).maybeSingle();
        if (inventoryItem) await supabase.from('user_inventory').update({ quantity: inventoryItem.quantity + 1 }).eq('id', inventoryItem.id);
        else await supabase.from('user_inventory').insert({ user_id: sessionUserId, item_id: item.id, quantity: 1 });
      }
      await supabase.from('user_notifications').insert({ user_id: sessionUserId, title: 'すれ違い通信', content: 'ほかのユーザーとすれ違いました！「ぺたるの香り」を手に入れました。' });
      alert('📡 すれ違い通信が発生しました！お知らせを確認してください。');
      playSound('item');
    } catch (err) { console.error('すれ違いエラー', err); }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setLocation(newLoc);
          if (prevLocation) {
            const dist = getDistance(prevLocation.lat, prevLocation.lng, newLoc.lat, newLoc.lng);
            if (dist > 2 && dist < 50) {
              const newDistance = walkDistance + dist;
              setWalkDistance(newDistance);
              if (petId) await supabase.from('pets').update({ walk_distance_m: newDistance }).eq('id', petId);
              if (Math.random() < 0.10) triggerEncounter();
            }
          }
          setPrevLocation(newLoc);
        },
        (error) => console.error("GPSエラー", error), 
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [prevLocation, walkDistance, petId, supabase]);

  useEffect(() => {
    if (location && landmarks.length > 0) {
      setActiveLandmark(landmarks.find(lm => getDistance(location.lat, location.lng, lm.latitude, lm.longitude) <= lm.radius_meters) || null);
    }
  }, [location, landmarks]);

  const getFacilityType = (name: string) => {
    if (name.includes('ご飯') || name.includes('レストラン') || name.includes('カフェ')) return 'restaurant';
    if (name.includes('病院') || name.includes('クリニック') || name.includes('ドクター')) return 'hospital';
    if (name.includes('ホテル') || name.includes('宿')) return 'hotel';
    return 'normal';
  };

  const handleCheckIn = async () => {
    if (!activeLandmark || !petId || !sessionUserId) return;
    const today = new Date().toLocaleDateString('sv-SE'); 
    const master = activeLandmark.landmark_masters;
    const facilityType = master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(activeLandmark.name);

    if (petCondition === 'starving' && facilityType !== 'restaurant') return alert('お腹が減りすぎて動けません…【ご飯屋さん】を探してください。');
    if (petCondition === 'sick' && facilityType !== 'hospital') return alert('体調が優れません…【病院】を探してください。');

    const { error: visitError } = await supabase.from('landmark_visits').insert({ user_id: sessionUserId, landmark_id: activeLandmark.id, visited_date: today });
    if (visitError) return alert('今日は既に訪問済みです！');
    
    setLandmarkVisitCount(prev => prev + 1);
    playSound('levelup');
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'landmark_visit', points_earned: activeLandmark.bonus_points });
    
    if (facilityType === 'restaurant') {
      alert(`🍽️ ${activeLandmark.name} に到着！\n美味しい匂いに釣られて元気が出た！`);
      if (petCondition === 'starving') await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      const now = new Date().toISOString(); setLastFedAt(now); setHungerPercent(100);
      await supabase.from('pets').update({ last_fed_at: now }).eq('id', petId);
    } else if (facilityType === 'hospital') {
      alert(`🏥 ${activeLandmark.name} で診察を受けました！\n体調が全回復しました！`);
      if (petCondition === 'sick') await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      setMotivationPercent(100);
    } else if (facilityType === 'hotel') {
      alert(`🏨 ${activeLandmark.name} でぐっすり休憩！\nごきげんがMAXになりました！`);
      setMotivationPercent(100);
    } else {
      alert(`🎉 ${activeLandmark.name} で ${activeLandmark.bonus_points} ポイント獲得！\n経験値が大幅にアップ！`);
    }

    const newExp = exp + 100;
    setExp(newExp);
    await supabase.from('pets').update({ exp: newExp }).eq('id', petId);
  };

  const takeSnapshot = () => {
    playSound('camera');
    const video = document.querySelector('video'); const aframeCanvas = document.querySelector('.a-canvas') as HTMLCanvasElement;
    if (!video || !aframeCanvas) return alert('カメラの準備ができていません');
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth || window.innerWidth; canvas.height = video.videoHeight || window.innerHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height); ctx.drawImage(aframeCanvas, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a'); link.download = `straid-ar-snap-${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  };

  if (!isClient || isAuthChecking || (sessionUserId && !isDataLoaded)) {
    return (
      <div className="bg-black w-full h-full flex flex-col items-center justify-center text-white fixed inset-0 z-[9999]">
        <div className="w-10 h-10 border-4 border-gray-500 border-t-white rounded-full animate-spin mb-4"></div>
        <p className="font-bold">データ読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden text-white">
      {/* 🌟 徹底的に背景を透過し、Videoを最背面に配置するCSS */}
      <style jsx global>{`
        html, body, #__next {
          background-color: transparent !important;
          background: transparent !important;
          margin: 0; padding: 0;
        }
        .a-canvas {
          position: absolute !important;
          top: 0 !important; left: 0 !important;
          width: 100% !important; height: 100% !important;
          z-index: 0 !important;
          background-color: transparent !important;
        }
        video {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100vw !important; height: 100vh !important;
          object-fit: cover !important;
          z-index: -1 !important;
        }
        .a-enter-vr { display: none !important; }
      `}</style>

      {/* 🌟 AR.js のみ読み込む（MindARは読み込まない） */}
      <Script src="https://aframe.io/releases/1.5.0/aframe.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.2.0/dist/aframe-extras.min.js" strategy="beforeInteractive" />
      <Script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar-nft.js" strategy="beforeInteractive" />

      {/* --- UIレイヤー (ヘッダー) --- */}
      {sessionUserId && (
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none">
          <div className="flex justify-between items-end">
            <span className="text-white font-bold text-3xl drop-shadow-lg bg-black/30 px-3 py-1 rounded-xl backdrop-blur-sm">{displayName}</span>
          </div>
        </div>
      )}

      {/* --- 右上ボタン群 --- */}
      <div className="absolute top-20 right-4 z-40 flex flex-col gap-4 pointer-events-auto">
        <button 
          onClick={() => { setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment'); setSceneKey(k => k + 1); playSound('tap'); }} 
          className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14" 
          aria-label="カメラ切替"
        >
          <span className="text-2xl">🔄</span>
        </button>
        <button onClick={takeSnapshot} className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14" aria-label="写真を撮る">
          <span className="text-2xl">📸</span>
        </button>
      </div>

      {/* --- UIレイヤー (ボトム) --- */}
      <div className="absolute z-40 bottom-0 w-full p-4 flex flex-col gap-4 pointer-events-auto">
        <div className="bg-green-600/90 text-white p-3 rounded-xl font-bold shadow-lg w-full text-center text-sm backdrop-blur-sm">
          {location ? `🚶‍♂️ 現在地周辺を散歩中... ${petId ? `(歩行: ${Math.floor(walkDistance)}m / 約${stepCount}歩)` : ''}` : '📡 GPSを探索中...'}
        </div>
        {activeLandmark && !isEgg && petId && (
          <button 
            onClick={handleCheckIn} 
            className={`p-4 rounded-2xl font-bold shadow-2xl w-full border-4 animate-bounce text-lg text-white 
              ${(activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hospital' ? 'bg-gradient-to-br from-purple-400 to-purple-600 border-purple-200' 
              : (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'restaurant' ? 'bg-gradient-to-br from-red-400 to-red-600 border-red-200' 
              : (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hotel' ? 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-200'
              : 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-200 text-yellow-900'}`}
          >
            ✨ 【{activeLandmark.name}】を発見！<br/>タップしてチェックイン！
          </button>
        )}

        <button 
          onClick={() => { setIsSpotMapOpen(true); playSound('tap'); }} 
          className="bg-gradient-to-r from-teal-400 to-teal-600 text-white p-3 rounded-2xl font-bold shadow-lg w-full flex justify-center items-center gap-2 border-2 border-teal-300 active:scale-95 transition-transform text-lg"
        >
          🗺️ 地図でスポットを探す
        </button>

        {/* 🌟 ページ遷移用ナビゲーション（フルリロード） */}
        <div className="flex justify-around bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
          <button onClick={() => { playSound('tap'); window.location.href = '/home'; }} className="font-bold flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"><span className="text-xl">🏠</span><span className="text-xs">おうち</span></button>
          <button onClick={() => { playSound('tap'); window.location.href = '/walk'; }} className="font-bold flex flex-col items-center gap-1 text-green-600"><span className="text-xl">🚶</span><span className="text-xs">さんぽ</span></button>
          <button onClick={() => { playSound('tap'); window.location.href = '/report'; }} className="font-bold flex flex-col items-center gap-1 text-gray-400 hover:text-purple-600 transition-colors"><span className="text-xl">📊</span><span className="text-xs">きろく</span></button>
        </div>
      </div>

      {isSpotMapOpen && (
        <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-center border-b pb-3 mb-4 text-slate-800">🗺️ 周辺のスポット</h2>
            {!location ? (
              <p className="text-center text-gray-500 my-10">GPS座標を取得中...</p>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="relative w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-4 shadow-inner border border-gray-300">
                  <iframe width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0} src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.005}%2C${location.lat - 0.005}%2C${location.lng + 0.005}%2C${location.lat + 0.005}&layer=mapnik`} className="absolute inset-0 z-0 pointer-events-none"></iframe>
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-md animate-pulse"></div></div>
                  <div className="absolute inset-0 z-20 pointer-events-none">
                  {landmarks.map(spot => {
                     const master = spot.landmark_masters;
                     const facilityType = master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(spot.name);
                     const typeIcon = facilityType === 'hospital' ? '🏥' : facilityType === 'restaurant' ? '🍽️' : facilityType === 'hotel' ? '🏨' : '📍';
                     const topPercent = 50 - ((spot.latitude - location.lat) / 0.01) * 100;
                     const leftPercent = 50 + ((spot.longitude - location.lng) / 0.01) * 100;
                     return (
                       <div key={`radar-${spot.id}`} className="absolute w-8 h-8 -ml-4 -mt-4 text-xl flex items-center justify-center filter drop-shadow bg-white/90 rounded-full border border-gray-300 shadow-sm" style={{ top: `${topPercent}%`, left: `${leftPercent}%` }} title={spot.name}>{typeIcon}</div>
                     )
                  })}
                  </div>
                </div>
                <div className="space-y-3">
                  {landmarks.map(spot => {
                    const dist = getDistance(location.lat, location.lng, spot.latitude, spot.longitude);
                    const master = spot.landmark_masters;
                    const facilityType = master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(spot.name);
                    return (
                      <div key={`list-${spot.id}`} className="bg-gray-50 border rounded-xl p-3 flex justify-between items-center shadow-sm">
                        <div>
                           <div className="font-bold text-gray-800 flex items-center gap-1">{facilityType === 'hospital' ? '🏥' : facilityType === 'restaurant' ? '🍽️' : facilityType === 'hotel' ? '🏨' : '📍'} {spot.name}</div>
                           <div className="text-xs text-gray-500">現在地から約 {Math.floor(dist)}m</div>
                        </div>
                      </div>
                    )
                  })}
                  {landmarks.length === 0 && <p className="text-xs text-gray-500 text-center">周辺にスポットが見つかりません</p>}
                </div>
              </div>
            )}
            <button onClick={() => setIsSpotMapOpen(false)} className="mt-4 w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl active:scale-95 transition-transform">閉じる</button>
          </div>
        </div>
      )}

      {/* --- 背面：ARレイヤー（AR.js専用） --- */}
      <div className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none">
        {location && isDataLoaded && (
          <div key={`gps-container-${sceneKey}-${cameraFacing}`} className="absolute inset-0 z-0 pointer-events-auto">
            {/* @ts-ignore */}
            <a-scene embedded style={{ height: '100%', width: '100%', pointerEvents: 'auto' }} vr-mode-ui="enabled: false" renderer="preserveDrawingBuffer: true; colorManagement: true; alpha: true;" arjs={`sourceType: webcam; videoTexture: true; debugUIEnabled: false; facingMode: ${cameraFacing};`}>
              {/* @ts-ignore */}
              <a-assets><a-asset-item id="pet-asset-gps" src={activeModelUrl}></a-asset-item>{activeLandmark && activeLandmark.model_url && (<a-asset-item id="landmark-asset-dynamic" src={activeLandmark.model_url}></a-asset-item>)}</a-assets>
              {/* @ts-ignore */}
              <a-light type="ambient" color="#ffffff" intensity="0.7"></a-light>
              {/* @ts-ignore */}
              <a-light type="directional" color="#ffffff" intensity="1.5" position="0 5 0"></a-light>
              
              {/* @ts-ignore */}
              <a-camera gps-camera rotation-reader>
                {!isEgg && petId && (
                  /* @ts-ignore */
                  <a-entity
                    gltf-model={activeModelUrl}
                    scale="1.5 1.5 1.5"
                    position={`0 -1.5 ${cameraFacing === 'user' ? '-2' : '-4'}`}
                    rotation={`0 180 0`}
                    animation-mixer={`clip: ${petCondition !== 'healthy' ? 'Sad' : 'Walk'}; loop: repeat; crossFadeDuration: 0.3;`}
                  ></a-entity>
                )}
              </a-camera>

              {activeLandmark && !isEgg && petId && (
                /* @ts-ignore */
                <a-entity gps-entity-place={`latitude: ${activeLandmark.latitude}; longitude: ${activeLandmark.longitude};`} gltf-model={activeLandmark.model_url ? "#landmark-asset-dynamic" : "/models/treasure.glb"} scale="5 5 5" position="0 2 0" animation="property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear;"></a-entity>
              )}
            </a-scene>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WalkARPage() {
  return (
    <Suspense fallback={<div className="bg-black w-full h-full text-white flex items-center justify-center">さんぽモードを起動中...</div>}>
      <WalkAR />
    </Suspense>
  );
}