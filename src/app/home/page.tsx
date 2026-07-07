'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { hatchPet } from '@/app/actions/gacha';

// --- サウンド再生用ヘルパー ---
const playSound = (type: 'tap' | 'eat' | 'hatch' | 'levelup' | 'item' | 'error') => {
  const audio = new Audio(`/sounds/${type}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {}); // ユーザーがまだ画面操作していない時のAutoplayエラーを無視
};

// 2点間の距離をメートルで計算する関数
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function HomeAR() {
  const searchParams = useSearchParams();
  const tagCode = searchParams.get('tag');
  const supabase = createClient();
  
  const [viewMode, setViewMode] = useState<'mindar' | 'gps' | 'report'>('mindar');
  const [isClient, setIsClient] = useState(false);
  
  // --- ユーザー・ペット情報 ---
  const [petId, setPetId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [affection, setAffection] = useState(0);
  const [petName, setPetName] = useState<string>('');
  const [sleepingUntil, setSleepingUntil] = useState<string | null>(null);
  const [lastFedAt, setLastFedAt] = useState<string | null>(null);
  
  // --- レベル・経験値・卵 State ---
  const [isEgg, setIsEgg] = useState(true);
  const [isEggUnregistered, setIsEggUnregistered] = useState(false); // まだDBにない完全新規のNFCか
  const [walkDistance, setWalkDistance] = useState(0);
  const [level, setLevel] = useState(1);
  const [exp, setExp] = useState(0);
  
  // --- 表示するモデル・マーカー ---
  const [petModelUrlV1, setPetModelUrlV1] = useState<string>('/models/egg.glb');
  const [petModelUrlV2, setPetModelUrlV2] = useState<string | null>(null);
  const [petModelUrlV3, setPetModelUrlV3] = useState<string | null>(null);
  const [petMarkerUrl, setPetMarkerUrl] = useState<string>('/targets.mind'); 

  // --- インベントリ ＆ ショップ ---
  const [inventory, setInventory] = useState<any[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [isShopOpen, setIsShopOpen] = useState(false);

  // --- ゲージ・感情 State ---
  const [hungerPercent, setHungerPercent] = useState(100);
  const [motivationPercent, setMotivationPercent] = useState(100);
  const [actionAnim, setActionAnim] = useState<string | null>(null);

  // --- GPS State ---
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prevLocation, setPrevLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [activeLandmark, setActiveLandmark] = useState<any | null>(null);

  const [sceneKey, setSceneKey] = useState(0);
  const targetDistanceToHatch = 500; // 孵化に必要な歩行距離(メートル)

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    setSceneKey(prev => prev + 1);
    const streams = navigator.mediaDevices?.getUserMedia ? true : false;
    if (streams) {
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});
    }
  }, [viewMode]);

  // --- データ取得 ---
  useEffect(() => {
    const fetchData = async () => {
      if (!tagCode) return;
      
      const { data: pet } = await supabase
        .from('pets')
        // 新しく追加したカラム (is_egg, walk_distance_m, level, exp) と、マスターのv2,v3 を取得
        .select(`
          id, owner_id, affection_level, sleeping_until, last_fed_at, 
          is_egg, walk_distance_m, level, exp,
          pet_masters(name, model_url, model_url_v2, model_url_v3, marker_url), 
          nfc_tags!inner(tag_code)
        `)
        .eq('nfc_tags.tag_code', tagCode)
        .maybeSingle();

      if (pet) {
        setPetId(pet.id); setOwnerId(pet.owner_id); setAffection(pet.affection_level || 0); 
        setSleepingUntil(pet.sleeping_until); setLastFedAt(pet.last_fed_at); 
        
        setIsEgg(pet.is_egg);
        setWalkDistance(pet.walk_distance_m || 0);
        setLevel(pet.level || 1);
        setExp(pet.exp || 0);

        // @ts-ignore
        if (pet.pet_masters) { 
          // @ts-ignore
          setPetModelUrlV1(pet.pet_masters.model_url);
          // @ts-ignore
          setPetModelUrlV2(pet.pet_masters.model_url_v2);
          // @ts-ignore
          setPetModelUrlV3(pet.pet_masters.model_url_v3);
          // @ts-ignore
          setPetMarkerUrl(pet.pet_masters.marker_url || '/targets.mind'); 
          // @ts-ignore
          setPetName(pet.pet_masters.name); 
        }

        const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', pet.owner_id).gt('quantity', 0);
        if (inv) setInventory(inv);
      } else {
        // DBに存在しない = 完全な新規タグ
        setIsEggUnregistered(true);
        setIsEgg(true); 
        setPetModelUrlV1('/models/egg.glb'); 
        setPetMarkerUrl('/targets.mind');
      }

      const { data: items } = await supabase.from('item_masters').select('*').order('id', { ascending: false });
      if (items) setShopItems(items);

      const { data: spots } = await supabase.from('landmarks').select('*');
      if (spots) setLandmarks(spots);
    };
    fetchData();
  }, [tagCode, supabase]);

  // --- レベルに応じたモデル表示の判定 ---
  const getCurrentModelUrl = () => {
    if (isEgg || isEggUnregistered) return '/models/egg.glb'; // 卵モデルを用意してください
    if (level >= 10 && petModelUrlV3) return petModelUrlV3;   // 第3形態
    if (level >= 5 && petModelUrlV2) return petModelUrlV2;    // 第2形態
    return petModelUrlV1;                                     // 第1形態
  };
  const activeModelUrl = getCurrentModelUrl();

  const isSleeping = sleepingUntil ? new Date(sleepingUntil) > new Date() : false;

  // --- ステータス計算 ---
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

  const getCurrentMood = () => {
    if (isEgg || isEggUnregistered) return { text: '🥚 卵', color: 'bg-gray-500', clip: 'Idle' };
    if (isSleeping) return { text: '💤 爆睡中', color: 'bg-blue-600', clip: 'Sleep' };
    if (hungerPercent <= 30) return { text: '💢 はらぺこ・激おこ', color: 'bg-red-600', clip: 'Angry' };
    if (motivationPercent <= 30) return { text: '💧 しょんぼり', color: 'bg-blue-400', clip: 'Sad' };
    if (motivationPercent >= 80) return { text: '✨ 絶好調！', color: 'bg-pink-500', clip: 'Happy' };
    return { text: '😐 おだやか', color: 'bg-green-500', clip: 'Idle' };
  };
  const currentMood = getCurrentMood();

  // --- 経験値獲得とレベルアップ処理 ---
  const addExperience = async (amount: number) => {
    if (!petId || isEgg) return;
    let newExp = exp + amount;
    let newLevel = level;
    let leveledUp = false;

    // 次のレベルに必要な経験値 (例: Lv1->100, Lv2->200, Lv3->300...)
    const expNeeded = newLevel * 100;
    if (newExp >= expNeeded) {
      newExp -= expNeeded;
      newLevel += 1;
      leveledUp = true;
    }

    setExp(newExp);
    setLevel(newLevel);
    await supabase.from('pets').update({ exp: newExp, level: newLevel }).eq('id', petId);

    if (leveledUp) {
      playSound('levelup');
      alert(`🌟 レベルアップ！ Lv.${newLevel} になりました！`);
      // レベル5や10のタイミングならモデル進化のアナウンスを入れることも可能
      if (newLevel === 5 && petModelUrlV2) alert('体が大きくなったみたい…！');
      if (newLevel === 10 && petModelUrlV3) alert('姿が大きく変わった…！');
    }
  };

  // --- GPS位置取得 と 距離計算（卵の孵化用） ---
  useEffect(() => {
    if (viewMode === 'gps' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setLocation(newLoc);

          // 移動距離の加算 (ワープ等のGPSブレを防ぐため、2m〜50mの移動のみカウント)
          if (prevLocation) {
            const dist = getDistance(prevLocation.lat, prevLocation.lng, newLoc.lat, newLoc.lng);
            if (dist > 2 && dist < 50) {
              const newDistance = walkDistance + dist;
              setWalkDistance(newDistance);
              
              // 卵の場合、DBに歩行距離を保存
              if (isEgg && petId) {
                await supabase.from('pets').update({ walk_distance_m: newDistance }).eq('id', petId);
              }
            }
          }
          setPrevLocation(newLoc);
        },
        (error) => console.error("GPSエラー", error), 
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [viewMode, prevLocation, walkDistance, isEgg, petId, supabase]);

  useEffect(() => {
    if (viewMode === 'gps' && location && landmarks.length > 0) {
      const nearbySpot = landmarks.find(lm => getDistance(location.lat, location.lng, lm.latitude, lm.longitude) <= lm.radius_meters);
      setActiveLandmark(nearbySpot || null);
    }
  }, [location, landmarks, viewMode]);

  // --- タップ判定 ---
  useEffect(() => {
    if (viewMode === 'mindar' && petId && !isEgg && !isSleeping) {
      const petModel = document.querySelector('#pet-model');
      const handlePetTap = () => {
        playSound('tap');
        setAffection(prev => { const val = prev + 1; supabase.from('pets').update({ affection_level: val }).eq('id', petId).then(); return val; });
        setActionAnim('*');
        addExperience(5); // タップで経験値5獲得
        setTimeout(() => setActionAnim(null), 1500);
      };
      petModel?.addEventListener('click', handlePetTap);
      return () => petModel?.removeEventListener('click', handlePetTap);
    }
  }, [viewMode, isClient, petId, supabase, isEgg, isSleeping, sceneKey]);


  // --- アクション系関数 ---

  // 初回タグ読み込み時の「卵ガチャ」生成
  const handleCreateEgg = async () => {
    if (!tagCode) return;
    try {
      const result = await hatchPet(tagCode); // ガチャでペットを確定させるが、状態は卵(is_egg=true)にするようサーバー側を修正予定
      if (result.success) {
        setPetId(result.pet.id); setOwnerId(result.pet.owner_id); 
        setIsEgg(true); // 生成時は卵
        setIsEggUnregistered(false);
        setWalkDistance(0);
        
        // @ts-ignore
        setPetModelUrlV1(result.pet.pet_masters.model_url);
        // @ts-ignore
        setPetMarkerUrl(result.pet.pet_masters.marker_url || '/targets.mind');
        // @ts-ignore
        setPetName(result.pet.pet_masters.name);
        
        playSound('item');
        alert(`不思議な卵を拾った！\nさんぽ機能で ${targetDistanceToHatch}m 歩いて孵化させよう！`);
      }
    } catch (err) { alert('エラーが発生しました。'); }
  };

  // 距離を満たして、卵から孵す
  const handleHatchEgg = async () => {
    if (!petId) return;
    playSound('hatch');
    setIsEgg(false);
    setLastFedAt(new Date().toISOString());
    await supabase.from('pets').update({ is_egg: false, last_fed_at: new Date().toISOString() }).eq('id', petId);
    alert(`✨ おめでとう！\n卵から ${petName} が生まれました！`);
  };

  const handleFeed = async () => {
    if (!petId || isEgg || isSleeping) return;
    playSound('eat');
    setActionAnim('Eat'); setTimeout(() => setActionAnim(null), 2000);
    const now = new Date().toISOString(); setLastFedAt(now); setHungerPercent(100);
    await supabase.from('pets').update({ last_fed_at: now }).eq('id', petId);
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'feed', points_earned: 10 });
    addExperience(20); // ごはんで経験値20獲得
  };

  const handleUseItem = async (invItem: any) => {
    if (!petId || isSleeping) return;
    const item = invItem.item_masters;
    setIsInventoryOpen(false);
    playSound('item');
    
    setInventory(prev => prev.map(i => i.id === invItem.id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
    await supabase.from('user_inventory').update({ quantity: invItem.quantity - 1 }).eq('id', invItem.id);

    if (item.item_type === 'food') {
      const newAffection = affection + item.effect_value; const now = new Date().toISOString();
      setAffection(newAffection); setLastFedAt(now); setHungerPercent(100);
      await supabase.from('pets').update({ affection_level: newAffection, last_fed_at: now }).eq('id', petId);
      setActionAnim('Eat'); setTimeout(() => setActionAnim(null), 2000);
      addExperience(50); // 高級アイテムは経験値50獲得
      alert(`✨ ${item.name} をあげました！`);
    } else if (item.item_type === 'sleep') {
      const sleepEnd = new Date(); sleepEnd.setHours(sleepEnd.getHours() + item.effect_value);
      setSleepingUntil(sleepEnd.toISOString());
      await supabase.from('pets').update({ sleeping_until: sleepEnd.toISOString() }).eq('id', petId);
      alert(`💤 ペットは ${item.effect_value} 時間眠りにつきました。`);
    }
  };

  const handleBuyItem = async (shopItem: any) => {
    if (!ownerId) return;
    const confirmBuy = window.confirm(`${shopItem.name} を ¥${shopItem.price_jpy} で購入しますか？`);
    if (!confirmBuy) return;

    try {
      playSound('item');
      const existingItem = inventory.find(i => i.item_masters.id === shopItem.id);
      if (existingItem) {
        await supabase.from('user_inventory').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
      } else {
        await supabase.from('user_inventory').insert({ user_id: ownerId, item_id: shopItem.id, quantity: 1 });
      }
      const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', ownerId).gt('quantity', 0);
      if (inv) setInventory(inv);
      alert('🛍️ 購入しました！「もちもの」から使用できます。');
    } catch (e) { alert('エラーが発生しました'); }
  };

  const handleCheckIn = async () => {
    if (!activeLandmark || !petId || !ownerId) return;
    const today = new Date().toLocaleDateString('sv-SE'); 
    const { error: visitError } = await supabase.from('landmark_visits').insert({ user_id: ownerId, landmark_id: activeLandmark.id, visited_date: today });
    if (visitError) return alert('今日は既に訪問済みです！');
    
    playSound('levelup');
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'landmark_visit', points_earned: activeLandmark.bonus_points });
    addExperience(100); // ランドマーク訪問で大量の経験値を獲得
    alert(`🎉 ${activeLandmark.name} で ${activeLandmark.bonus_points} ポイント獲得！\n経験値が大幅にアップ！`);
  };

  if (!isClient) return <div className="bg-black w-full h-screen"></div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <Script src="https://aframe.io/releases/1.5.0/aframe.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.2.0/dist/aframe-extras.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js" strategy="beforeInteractive" />
      <Script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar-nft.js" strategy="beforeInteractive" />

      {/* --- UIレイヤー (ヘッダー: ゲージ ＆ 感情バッジ) --- */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none">
        <div className="flex justify-between items-end">
          <span className="text-white font-bold text-2xl drop-shadow-lg">{isEggUnregistered ? '謎のNFCタグ' : petName}</span>
          <span className={`${currentMood.color} text-white px-3 py-1.5 rounded-lg font-bold shadow-md text-sm transition-colors duration-300`}>{currentMood.text}</span>
        </div>

        {/* 卵の時は孵化ゲージを表示 */}
        {(isEgg && !isEggUnregistered) && (
          <div className="bg-black/80 p-3 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-yellow-500">
            <div className="flex justify-between text-xs font-bold text-yellow-400 mb-1.5">
              <span>🥚 孵化まであと {Math.max(0, targetDistanceToHatch - Math.floor(walkDistance))} m</span>
              <span>{Math.floor((walkDistance / targetDistanceToHatch) * 100)}%</span>
            </div>
            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden shadow-inner border border-gray-600">
              <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000" style={{ width: `${Math.min(100, (walkDistance / targetDistanceToHatch) * 100)}%` }}></div>
            </div>
            <p className="text-[10px] text-gray-300 mt-2">「🚶さんぽ」モードで歩くと距離がカウントされます。</p>
          </div>
        )}

        {/* 孵化済みの時は通常ステータスと経験値ゲージ */}
        {(!isEgg && !isEggUnregistered && petId) && (
          <>
            <div className="bg-black/60 p-2.5 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-gray-700">
              <div className="flex justify-between text-xs font-bold text-white mb-1.5"><span>🍖 たいりょく</span><span>{hungerPercent}%</span></div>
              <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-1000 ${hungerPercent < 30 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${hungerPercent}%` }}></div></div>
            </div>
            <div className="bg-black/60 p-2.5 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-gray-700">
              <div className="flex justify-between text-xs font-bold text-white mb-1.5"><span>💖 ごきげん</span><span>{motivationPercent}%</span></div>
              <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-1000" style={{ width: `${motivationPercent}%` }}></div></div>
            </div>
            {/* 経験値・レベルゲージ */}
            <div className="bg-black/60 p-2.5 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-blue-500">
              <div className="flex justify-between text-xs font-bold text-blue-200 mb-1.5">
                <span>🌟 Lv.{level}</span>
                <span>EXP: {exp} / {level * 100}</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(exp / (level * 100)) * 100}%` }}></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- UIレイヤー (ボトム: ボタン類とモーダル) --- */}
      <div className="absolute z-10 bottom-0 w-full p-4 flex flex-col gap-4 pointer-events-auto">
        
        {/* ショップ・インベントリモダール (省略せずに前回と同様に維持) */}
        {isShopOpen && (
          <div className="absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-xl text-gray-800">🛒 おみせ</h3>
              <button onClick={() => setIsShopOpen(false)} className="text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200">閉じる</button>
            </div>
            {shopItems.length === 0 ? ( <p className="text-gray-500 text-center py-8">現在販売中のアイテムはありません</p> ) : (
              <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {shopItems.map((item) => (
                  <div key={item.id} className="bg-white border rounded-2xl p-3 flex flex-col shadow-sm">
                    {item.image_url ? ( <img src={item.image_url} alt={item.name} className="w-full h-24 object-cover rounded-xl mb-2 bg-gray-100" /> ) : ( <div className="w-full h-24 bg-blue-50 rounded-xl mb-2 flex items-center justify-center text-3xl">🎁</div> )}
                    <h4 className="font-bold text-gray-800 text-sm leading-tight mb-1">{item.name}</h4>
                    <span className="text-[10px] text-gray-500 mb-2 line-clamp-2 leading-tight">{item.description}</span>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-bold text-blue-600 text-sm">¥{item.price_jpy}</span>
                      <button onClick={() => handleBuyItem(item)} className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95">購入</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isInventoryOpen && (
          <div className="absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-xl text-gray-800">🎒 もちもの</h3>
              <button onClick={() => setIsInventoryOpen(false)} className="text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200">閉じる</button>
            </div>
            {inventory.length === 0 ? ( <p className="text-gray-500 text-center py-8">アイテムを持っていません。<br/>「おみせ」で買ってみよう！</p> ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {inventory.map((invItem) => (
                  <button key={invItem.id} onClick={() => handleUseItem(invItem)} className="flex-shrink-0 bg-white border border-blue-100 rounded-2xl p-3 w-32 flex flex-col text-left shadow-sm active:scale-95 transition-transform">
                    {invItem.item_masters.image_url ? ( <img src={invItem.item_masters.image_url} className="w-full h-16 object-cover rounded-lg mb-2" /> ) : ( <div className="w-full h-16 bg-blue-50 rounded-lg mb-2 flex items-center justify-center text-2xl">📦</div> )}
                    <div className="font-bold text-blue-900 text-sm truncate">{invItem.item_masters.name}</div>
                    <div className="mt-auto text-right text-xs font-bold text-blue-600 pt-2">所持: {invItem.quantity}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 1. 完全新規タグのガチャボタン */}
        {viewMode === 'mindar' && isEggUnregistered && (
          <button onClick={handleCreateEgg} className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-2xl font-bold shadow-lg w-full animate-pulse text-lg border-4 border-yellow-200">
            🥚 不思議な卵を発見！<br/><span className="text-sm">タップして拾い上げる</span>
          </button>
        )}

        {/* 2. 卵状態で、距離が足りた場合の孵化ボタン */}
        {viewMode === 'mindar' && isEgg && !isEggUnregistered && walkDistance >= targetDistanceToHatch && (
          <button onClick={handleHatchEgg} className="bg-gradient-to-r from-pink-400 to-red-500 text-white p-4 rounded-2xl font-bold shadow-lg w-full animate-bounce text-lg border-4 border-pink-200">
            ✨ 卵が割れそうだ！<br/><span className="text-sm">タップして孵化させる</span>
          </button>
        )}

        {/* 3. 通常時のボタン群 */}
        {viewMode === 'mindar' && !isEgg && !isEggUnregistered && petId && (
          <div className="flex gap-2 w-full">
            <button onClick={handleFeed} disabled={isSleeping || hungerPercent === 100} className={`flex-[2] text-white py-3 rounded-2xl font-bold shadow-lg transition-all ${(isSleeping || hungerPercent === 100) ? 'bg-gray-400 opacity-80' : 'bg-gradient-to-br from-orange-400 to-orange-600 active:scale-95'}`}>
              🍚<br/><span className="text-xs">ごはん</span>
            </button>
            <button onClick={() => { setIsInventoryOpen(true); setIsShopOpen(false); playSound('tap'); }} className="flex-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center">
              🎒<br/><span className="text-xs">もちもの</span>
            </button>
            <button onClick={() => { setIsShopOpen(true); setIsInventoryOpen(false); playSound('tap'); }} className="flex-1 bg-gradient-to-br from-green-500 to-green-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center">
              🛒<br/><span className="text-xs">おみせ</span>
            </button>
          </div>
        )}
        
        {/* GPS時の表示 */}
        {viewMode === 'gps' && (
          <>
            <div className="bg-green-600/90 text-white p-3 rounded-xl font-bold shadow-lg w-full text-center text-sm backdrop-blur-sm">
              {location ? `🚶‍♂️ 現在地周辺を散歩中... ${isEgg ? `(歩行: ${Math.floor(walkDistance)}m)` : ''}` : '📡 GPSを探索中...'}
            </div>
            {activeLandmark && !isEgg && (
              <button onClick={handleCheckIn} className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 p-4 rounded-2xl font-bold shadow-2xl w-full border-4 border-yellow-200 animate-bounce text-lg">
                ✨ 【{activeLandmark.name}】を発見！<br/>タップして経験値GET！
              </button>
            )}
          </>
        )}

        <div className="flex justify-around bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
          <button onClick={() => { setViewMode('mindar'); playSound('tap'); }} className={`font-bold flex flex-col items-center gap-1 ${viewMode === 'mindar' ? 'text-blue-600' : 'text-gray-400'}`}><span className="text-xl">🏠</span><span className="text-xs">おうち</span></button>
          <button onClick={() => { setViewMode('gps'); playSound('tap'); }} className={`font-bold flex flex-col items-center gap-1 ${viewMode === 'gps' ? 'text-green-600' : 'text-gray-400'}`}><span className="text-xl">🚶</span><span className="text-xs">さんぽ</span></button>
          <button onClick={() => { setViewMode('report'); playSound('tap'); }} className={`font-bold flex flex-col items-center gap-1 ${viewMode === 'report' ? 'text-purple-600' : 'text-gray-400'}`}><span className="text-xl">📊</span><span className="text-xs">きろく</span></button>
        </div>
      </div>

      {/* --- 背面：ARレイヤー --- */}
      <div className="absolute top-0 left-0 w-full h-full z-0">
        {viewMode === 'mindar' && (
          /* @ts-ignore */
          <a-scene key={`mindar-${sceneKey}-${petMarkerUrl}`} mindar-image={`imageTargetSrc: ${petMarkerUrl}; autoStart: true; uiLoading: no; uiError: no;`} color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
            {/* @ts-ignore */}
            <a-assets><a-asset-item id="pet-asset" src={activeModelUrl}></a-asset-item></a-assets>
            {/* @ts-ignore */}
            <a-light type="ambient" color="#ffffff" intensity="0.5"></a-light>
            {/* @ts-ignore */}
            <a-light type="directional" color="#ffffff" intensity="1.5" position="-1 2 1" castShadow="true"></a-light>
            {/* @ts-ignore */}
            <a-camera position="0 0 0" look-controls="enabled: false" cursor="rayOrigin: mouse;" raycaster="objects: .clickable"></a-camera>
            {/* @ts-ignore */}
            <a-entity mindar-image-target="targetIndex: 0">
              {/* @ts-ignore */}
              <a-gltf-model id="pet-model" class={(!isEgg && !isSleeping) ? "clickable" : ""} rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src={activeModelUrl} shadow="cast: true; receive: true" animation-mixer={isEgg ? "" : `clip: ${actionAnim || currentMood.clip}; loop: ${actionAnim ? 'once' : 'repeat'}; timeScale: ${actionAnim === '*' ? 1.5 : 1.0}; crossFadeDuration: 0.3;`}></a-gltf-model>
            </a-entity>
          </a-scene>
        )}

        {viewMode === 'gps' && location && (
          /* @ts-ignore */
          <a-scene key={`gps-${sceneKey}`} vr-mode-ui="enabled: false" arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false;">
            {/* @ts-ignore */}
            <a-assets><a-asset-item id="pet-asset-gps" src={activeModelUrl}></a-asset-item>{activeLandmark && activeLandmark.model_url && (<a-asset-item id="landmark-asset-dynamic" src={activeLandmark.model_url}></a-asset-item>)}</a-assets>
            {/* @ts-ignore */}
            <a-light type="ambient" color="#ffffff" intensity="0.7"></a-light>
            {/* @ts-ignore */}
            <a-light type="directional" color="#ffffff" intensity="1.5" position="0 5 0"></a-light>
            {/* @ts-ignore */}
            <a-camera gps-camera rotation-reader></a-camera>
            {!isEgg && (
              /* @ts-ignore */
              <a-entity gps-entity-place={`latitude: ${location.lat}; longitude: ${location.lng};`} gltf-model={activeModelUrl} scale="2 2 2" position="0 -2 0" look-at="[gps-camera]" animation-mixer="clip: Walk; loop: repeat;"></a-entity>
            )}
            {activeLandmark && !isEgg && (
              /* @ts-ignore */
              <a-entity gps-entity-place={`latitude: ${activeLandmark.latitude}; longitude: ${activeLandmark.longitude};`} gltf-model={activeLandmark.model_url ? "#landmark-asset-dynamic" : "/models/treasure.glb"} scale="5 5 5" position="0 2 0" animation="property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear;"></a-entity>
            )}
          </a-scene>
        )}
      </div>
    </div>
  );
}