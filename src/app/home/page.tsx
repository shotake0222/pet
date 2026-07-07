'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { createClient } from '@/utils/supabase/client';
import { hatchPet } from '@/app/actions/gacha';

// --- サウンド再生用ヘルパー ---
const playSound = (type: 'tap' | 'eat' | 'hatch' | 'levelup' | 'item' | 'error' | 'camera') => {
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
  const [tagCode, setTagCode] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setTagCode(new URLSearchParams(window.location.search).get('tag'));
  }, []);
  
  const [viewMode, setViewMode] = useState<'mindar' | 'gps' | 'report'>('mindar');
  const [isClient, setIsClient] = useState(false);
  
  // --- ユーザー・ペット情報 ---
  const [petId, setPetId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [affection, setAffection] = useState(0);
  
  // プロフィール関連（カスタム名と誕生日）
  const [petMasterName, setPetMasterName] = useState<string>('');
  const [customName, setCustomName] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);

  const [sleepingUntil, setSleepingUntil] = useState<string | null>(null);
  const [lastFedAt, setLastFedAt] = useState<string | null>(null);
  
  // --- レベル・経験値・卵 State ---
  const [isEgg, setIsEgg] = useState(true);
  const [isEggUnregistered, setIsEggUnregistered] = useState(false); // まだDBにない完全新規のNFCか
  const [walkDistance, setWalkDistance] = useState(0);
  const [level, setLevel] = useState(1);
  const [exp, setExp] = useState(0);
  
  // --- 表示するモデル・マーカー ---
  const [petModelUrlV1, setPetModelUrlV1] = useState<string>('/models/eggs/default_egg.glb');
  const [petModelUrlV2, setPetModelUrlV2] = useState<string | null>(null);
  const [petModelUrlV3, setPetModelUrlV3] = useState<string | null>(null);
  const [petMarkerUrl, setPetMarkerUrl] = useState<string>('/targets.mind'); 

  // --- インベントリ ＆ ショップ ---
  const [inventory, setInventory] = useState<any[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [isShopOpen, setIsShopOpen] = useState(false);

  // --- お知らせ ＆ プロフィール設定 State ---
  const [newsList, setNewsList] = useState<any[]>([]);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [inputNickname, setInputNickname] = useState('');
  const [inputBirthYear, setInputBirthYear] = useState('');
  const [inputGender, setInputGender] = useState('');
  const [isSetupSubmitting, setIsSetupSubmitting] = useState(false);

  // --- ログインボーナス State ---
  const [loginBonusState, setLoginBonusState] = useState({
    days: 0,
    gotBonus: false,
    showModal: false,
  });

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
    const hasGetUserMedia = typeof navigator !== 'undefined' && 'mediaDevices' in navigator && typeof navigator.mediaDevices.getUserMedia === 'function';
    if (hasGetUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});
    }
  }, [viewMode]);

  // --- ログインボーナス処理用関数 ---
  const grantLoginBonusItem = async (userId: string) => {
    // 1. item_masters から「ログボご飯」を探す
    let { data: item } = await supabase.from('item_masters').select('id').eq('name', 'ログボご飯').maybeSingle();
    
    // 存在しない場合は、自動でアイテムマスターに作成する
    if (!item) {
      const { data: newItem, error } = await supabase.from('item_masters')
        .insert({
          name: 'ログボご飯',
          description: '7日間ログインしたご褒美！普通のご飯より少し多くやる気が回復する特別なおご飯。',
          item_type: 'food',
          price_jpy: 0,
          effect_value: 15, // 普通の食事(10)より少し高めに設定
          image_url: null 
        })
        .select('id').single();
      
      if (error) {
        console.error('Failed to create bonus item:', error);
        return;
      }
      item = newItem;
    }

    // 2. ユーザーのインベントリに付与
    const { data: inventoryItem } = await supabase.from('user_inventory')
      .select('id, quantity').eq('user_id', userId).eq('item_id', item.id).maybeSingle();

    if (inventoryItem) {
      await supabase.from('user_inventory').update({ quantity: inventoryItem.quantity + 1 }).eq('id', inventoryItem.id);
    } else {
      await supabase.from('user_inventory').insert({ user_id: userId, item_id: item.id, quantity: 1 });
    }
    
    // 3. インベントリの再取得をして即時反映
    const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', userId).gt('quantity', 0);
    if (inv) setInventory(inv);
  };

  const checkLoginBonus = async (userId: string, profile: any) => {
    const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const lastLoginDate = profile.last_login_date;
    let currentLoginDays = profile.login_days || 0;

    // 今日まだログインボーナスを受け取っていない場合
    if (lastLoginDate !== today) {
      // 日付が変わっている = ログインボーナス獲得
      currentLoginDays = (currentLoginDays >= 7) ? 1 : currentLoginDays + 1;
      
      let gotBonus = false;
      // 7日目ならプレゼント（ログボご飯）付与
      if (currentLoginDays === 7) {
        await grantLoginBonusItem(userId);
        gotBonus = true;
      }

      // DB更新 (※もしDBにカラムがない場合のエラーは無視して進める設計)
      await supabase.from('user_profiles').update({
        last_login_date: today,
        login_days: currentLoginDays
      }).eq('id', userId);

      setLoginBonusState({
        days: currentLoginDays,
        gotBonus: gotBonus,
        showModal: true
      });
      playSound('levelup'); // ボーナス表示音
    }
  };

  // --- データ取得 ---
  useEffect(() => {
    const fetchData = async () => {
      if (!tagCode) return;
      
      const { data: pet } = await supabase
        .from('pets')
        .select(`
          id, owner_id, affection_level, sleeping_until, last_fed_at, 
          is_egg, walk_distance_m, level, exp, custom_name, birthday,
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
        setCustomName(pet.custom_name);
        setBirthday(pet.birthday);

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
          setPetMasterName(pet.pet_masters.name); 
        }

        const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', pet.owner_id).gt('quantity', 0);
        if (inv) setInventory(inv);

        // --- プロフィールのチェック（未設定ならモーダル表示） ---
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', pet.owner_id).maybeSingle();
        if (!profile || !profile.birth_year) {
          setShowProfileSetup(true);
        } else {
          // プロフィール設定済みならログインボーナス判定を行う
          await checkLoginBonus(pet.owner_id, profile);
        }

      } else {
        // DBに存在しない = 完全な新規タグ
        setIsEggUnregistered(true);
        setIsEgg(true); 
        setPetModelUrlV1('/models/eggs/default_egg.glb'); 
        setPetMarkerUrl('/targets.mind');
      }

      const { data: items } = await supabase.from('item_masters').select('*').order('id', { ascending: false });
      if (items) setShopItems(items);

      const { data: spots } = await supabase.from('landmarks').select('*');
      if (spots) setLandmarks(spots);

      // --- お知らせ取得 ---
      const { data: news } = await supabase.from('announcements').select('*').eq('is_active', true).order('published_at', { ascending: false });
      if (news) setNewsList(news);

    };
    fetchData();
  }, [tagCode, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- レベルに応じたモデル表示の判定 ---
  const getCurrentModelUrl = () => {
    if (isEgg || isEggUnregistered) return '/models/eggs/default_egg.glb';
    if (level >= 10 && petModelUrlV3) return petModelUrlV3;   // 第3形態
    if (level >= 5 && petModelUrlV2) return petModelUrlV2;    // 第2形態
    return petModelUrlV1;                                     // 第1形態
  };
  const activeModelUrl = getCurrentModelUrl();
  const isSleeping = sleepingUntil ? new Date(sleepingUntil) > new Date() : false;
  
  // 表示名の判定（ユーザーが設定したニックネームがあれば優先）
  const displayName = customName || petMasterName;

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

    // 次のレベルに必要な経験値
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
        addExperience(5);
        setTimeout(() => setActionAnim(null), 1500);
      };
      petModel?.addEventListener('click', handlePetTap);
      return () => petModel?.removeEventListener('click', handlePetTap);
    }
  }, [viewMode, isClient, petId, supabase, isEgg, isSleeping, sceneKey]);


  // --- アクション系関数 ---

  const handleCreateEgg = async () => {
    if (!tagCode) return;
    try {
      const result = await hatchPet(tagCode);
      if (result.success) {
        setPetId(result.pet.id); setOwnerId(result.pet.owner_id); 
        setIsEgg(true); setIsEggUnregistered(false); setWalkDistance(0);
        
        // @ts-ignore
        setPetModelUrlV1(result.pet.pet_masters.model_url);
        // @ts-ignore
        setPetMarkerUrl(result.pet.pet_masters.marker_url || '/targets.mind');
        // @ts-ignore
        setPetMasterName(result.pet.pet_masters.name);
        
        playSound('item');
        alert(`不思議な卵を拾った！\nさんぽ機能で ${targetDistanceToHatch}m 歩いて孵化させよう！`);
        setShowProfileSetup(true); // 初回タグ作成時にもプロフィール設定を開く
      }
    } catch (err) { alert('エラーが発生しました。'); }
  };

  const handleHatchEgg = async () => {
    if (!petId) return;
    playSound('hatch');
    setIsEgg(false);
    const today = new Date().toISOString().split('T')[0]; // 今日の日付
    setBirthday(today);
    setLastFedAt(new Date().toISOString());
    
    await supabase.from('pets').update({ 
      is_egg: false, 
      last_fed_at: new Date().toISOString(),
      birthday: today 
    }).eq('id', petId);
    
    alert(`✨ おめでとう！\n卵から ${displayName} が生まれました！`);
  };

  const handleFeed = async () => {
    if (!petId || isEgg || isSleeping) return;
    playSound('eat');
    setActionAnim('Eat'); setTimeout(() => setActionAnim(null), 2000);
    const now = new Date().toISOString(); setLastFedAt(now); setHungerPercent(100);
    await supabase.from('pets').update({ last_fed_at: now }).eq('id', petId);
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'feed', points_earned: 10 });
    addExperience(20);
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
      addExperience(50);
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
    addExperience(100);
    alert(`🎉 ${activeLandmark.name} で ${activeLandmark.bonus_points} ポイント獲得！\n経験値が大幅にアップ！`);
  };

  // --- 写真撮影 (Snapshot) 処理 ---
  const takeSnapshot = () => {
    playSound('camera');
    
    const video = document.querySelector('video');
    const aframeCanvas = document.querySelector('.a-canvas') as HTMLCanvasElement;
    
    if (!video || !aframeCanvas) {
      alert('カメラの準備ができていません');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || window.innerWidth;
    canvas.height = video.videoHeight || window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 現実のカメラ映像を描画
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // AR空間の映像を描画
    ctx.drawImage(aframeCanvas, 0, 0, canvas.width, canvas.height);
    
    // ダウンロード
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `straid-ar-snap-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // --- プロフィール設定送信処理 ---
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setIsSetupSubmitting(true);
    try {
      const today = new Date().toLocaleDateString('sv-SE');
      
      // プロフィールのUpsert
      await supabase.from('user_profiles').upsert({
        id: ownerId,
        birth_year: parseInt(inputBirthYear, 10),
        gender: inputGender,
        email_notify_feed: true,
        email_notify_news: true,
        last_login_date: today, // 初回登録日をログインボーナスの起点に
        login_days: 1
      });
      // ペットの名前（ニックネーム）が入力されていれば更新
      if (petId && inputNickname) {
        await supabase.from('pets').update({ custom_name: inputNickname }).eq('id', petId);
        setCustomName(inputNickname);
      }
      setShowProfileSetup(false);
      alert('プロフィールを設定しました！');

      // 初回のログインボーナス(1日目)を表示
      setLoginBonusState({
        days: 1,
        gotBonus: false,
        showModal: true
      });
      playSound('levelup');

    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setIsSetupSubmitting(false);
    }
  };

  if (!isClient) return <div className="bg-black w-full h-screen"></div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <Script src="https://aframe.io/releases/1.5.0/aframe.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.2.0/dist/aframe-extras.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js" strategy="beforeInteractive" />
      <Script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar-nft.js" strategy="beforeInteractive" />

      {/* --- 初回プロフィール設定モーダル --- */}
      {showProfileSetup && (
        <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleProfileSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
            <h2 className="text-xl font-bold text-center border-b pb-3 text-slate-800">🎉 ようこそ Straid AR へ！</h2>
            <p className="text-xs text-gray-500 text-center mb-4">あなたとペットの情報を教えてください</p>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ペットのニックネーム</label>
              <input type="text" value={inputNickname} onChange={e => setInputNickname(e.target.value)} placeholder="例: ポチ" className="w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">あなたの誕生年</label>
                <input type="number" value={inputBirthYear} onChange={e => setInputBirthYear(e.target.value)} placeholder="1990" className="w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">性別</label>
                <select value={inputGender} onChange={e => setInputGender(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500" required>
                  <option value="">選択...</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                </select>
              </div>
            </div>
            <button disabled={isSetupSubmitting} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg mt-4 disabled:bg-gray-400">
              {isSetupSubmitting ? '保存中...' : 'はじめる！'}
            </button>
          </form>
        </div>
      )}

      {/* --- ウィークリーログインボーナス モーダル --- */}
      {loginBonusState.showModal && (
        <div className="absolute inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center animate-bounce">
            <h2 className="text-xl font-bold text-center mb-2 text-slate-800">🎁 ログインボーナス</h2>
            <p className="text-sm text-gray-600 mb-6 text-center">毎日ログインしてアイテムをゲットしよう！</p>
            
            <div className="grid grid-cols-4 gap-3 mb-6 w-full">
              {[1, 2, 3, 4, 5, 6].map(day => (
                <div key={day} className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 ${loginBonusState.days >= day ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className="text-[10px] font-bold text-gray-500 mb-1">{day}日目</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${loginBonusState.days >= day ? 'bg-orange-400 text-white' : 'bg-gray-200 text-transparent'}`}>
                    ✓
                  </div>
                </div>
              ))}
              {/* 7日目 (スタンプ) */}
              <div className={`col-span-2 flex flex-col items-center justify-center py-2 rounded-xl border-2 ${loginBonusState.days >= 7 ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-gray-50'}`}>
                 <span className="text-[10px] font-bold text-gray-500 mb-1">7日目 (ボーナス!)</span>
                 <div className={`text-3xl ${loginBonusState.days >= 7 ? 'opacity-100 drop-shadow-md' : 'opacity-30 grayscale'}`}>
                   🎁
                 </div>
              </div>
            </div>

            {/* ボーナス獲得時のメッセージ */}
            {loginBonusState.gotBonus && (
              <div className="bg-pink-100 text-pink-800 p-3 rounded-xl font-bold w-full text-center mb-4 text-sm shadow-inner">
                ✨「ログボご飯」をゲットしました！✨<br/>
                <span className="text-xs font-normal">もちものから使ってみよう！</span>
              </div>
            )}

            <button onClick={() => setLoginBonusState(prev => ({ ...prev, showModal: false }))} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-colors">
              受け取る
            </button>
          </div>
        </div>
      )}

      {/* --- お知らせ(News) モーダル --- */}
      {isNewsOpen && (
        <div className="absolute top-20 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200">
          <div className="flex justify-between items-center mb-4 border-b pb-3">
            <h3 className="font-bold text-xl text-gray-800">📢 運営からのお知らせ</h3>
            <button onClick={() => setIsNewsOpen(false)} className="text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200">閉じる</button>
          </div>
          {newsList.length === 0 ? ( <p className="text-gray-500 text-center py-8">現在お知らせはありません</p> ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {newsList.map((news) => (
                <div key={news.id} className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <h4 className="font-bold text-blue-900 mb-2">{news.title}</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{news.content}</p>
                  <div className="text-[10px] text-gray-500 mt-2 text-right">{new Date(news.published_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- UIレイヤー (ヘッダー: ゲージ ＆ 感情バッジ) --- */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none">
        <div className="flex justify-between items-end">
          <span className="text-white font-bold text-2xl drop-shadow-lg">{isEggUnregistered ? '謎のNFCタグ' : displayName}</span>
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

      {/* --- 右上ボタン群 (お知らせ ＆ 撮影) --- */}
      <div className="absolute top-48 right-4 z-40 flex flex-col gap-4 pointer-events-auto">
        {/* 📢 お知らせボタン */}
        <button 
          onClick={() => { setIsNewsOpen(true); playSound('tap'); }} 
          className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 flex items-center justify-center w-14 h-14 relative"
          aria-label="お知らせ"
        >
          <span className="text-2xl">📢</span>
          {newsList.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>}
        </button>
        
        {/* 📸 撮影ボタン */}
        <button 
          onClick={takeSnapshot}
          className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14"
          aria-label="写真を撮る"
        >
          <span className="text-2xl">📸</span>
        </button>
      </div>

      {/* --- UIレイヤー (ボトム: ボタン類とモーダル) --- */}
      <div className="absolute z-10 bottom-0 w-full p-4 flex flex-col gap-4 pointer-events-auto">
        
        {/* ショップ・インベントリモダール */}
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
            <button onClick={() => { setIsInventoryOpen(true); setIsShopOpen(false); setIsNewsOpen(false); playSound('tap'); }} className="flex-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center">
              🎒<br/><span className="text-xs">もちもの</span>
            </button>
            <button onClick={() => { setIsShopOpen(true); setIsInventoryOpen(false); setIsNewsOpen(false); playSound('tap'); }} className="flex-1 bg-gradient-to-br from-green-500 to-green-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center">
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
          <a-scene key={`mindar-${sceneKey}-${petMarkerUrl}`} mindar-image={`imageTargetSrc: ${petMarkerUrl}; autoStart: true; uiLoading: no; uiError: no;`} renderer="preserveDrawingBuffer: true; colorManagement: true; physicallyCorrectLights: true;" color-space="sRGB" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
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
          <a-scene key={`gps-${sceneKey}`} vr-mode-ui="enabled: false" renderer="preserveDrawingBuffer: true; colorManagement: true;" arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false;">
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