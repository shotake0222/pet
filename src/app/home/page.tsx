'use client';

import { useState, useEffect, useMemo } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { hatchPet } from '@/app/actions/gacha';

// --- サウンド再生用ヘルパー ---
const playSound = (type: 'tap' | 'eat' | 'hatch' | 'levelup' | 'item' | 'error' | 'camera') => {
  const audio = new Audio(`/sounds/${type}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {});
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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [viewMode, setViewMode] = useState<'mindar' | 'gps' | 'report'>('mindar');
  const [isClient, setIsClient] = useState(false);
  
  // --- セッション・ユーザー情報 ---
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [affection, setAffection] = useState(0);
  
  const [petMasterName, setPetMasterName] = useState<string>('');
  const [customName, setCustomName] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);

  const [sleepingUntil, setSleepingUntil] = useState<string | null>(null);
  const [lastFedAt, setLastFedAt] = useState<string | null>(null);
  
  // --- レベル・経験値・卵 State ---
  const [isEgg, setIsEgg] = useState(true);
  const [isEggUnregistered, setIsEggUnregistered] = useState(false);
  const [walkDistance, setWalkDistance] = useState(0);
  const [feedCount, setFeedCount] = useState(0);
  const [landmarkVisitCount, setLandmarkVisitCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [exp, setExp] = useState(0);
  
  // ターゲットマインド（マーカー）
  const petMarkerUrl = '/markers/target.mind'; 
  
  // 卵モデルはDBのegg_typeに応じて動的に変えるためのState
  const [eggModelUrl, setEggModelUrl] = useState<string>('/models/eggs/egg_A.glb');

  // 孵化後のペットモデル
  const [petModelUrlV1, setPetModelUrlV1] = useState<string>('');
  const [petModelUrlV2, setPetModelUrlV2] = useState<string | null>(null);
  const [petModelUrlV3, setPetModelUrlV3] = useState<string | null>(null);
  
  const [petRarity, setPetRarity] = useState<'N'|'R'|'SR'|'UR'|'?'>('?');
  const [hatchOverlay, setHatchOverlay] = useState<{ active: boolean; particles: any[]; rarity: string } | null>(null);
  const [hatchAnimating, setHatchAnimating] = useState(false);

  // --- 🌟 レベルアップ用エフェクト State ---
  const [levelUpOverlay, setLevelUpOverlay] = useState<{ active: boolean; particles: any[]; level: number; isMilestone: boolean } | null>(null);

  // --- インベントリ ＆ ショップ ---
  const [inventory, setInventory] = useState<any[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [isShopOpen, setIsShopOpen] = useState(false);

  // --- お知らせ ＆ プロフィール設定 State ---
  const [newsList, setNewsList] = useState<any[]>([]);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [inputBirthYear, setInputBirthYear] = useState('');
  const [inputGender, setInputGender] = useState('');
  const [isSetupSubmitting, setIsSetupSubmitting] = useState(false);

  // --- 孵化後の名付けモーダル State ---
  const [showNamingScreen, setShowNamingScreen] = useState(false);
  const [namingInput, setNamingInput] = useState('');
  const [isNamingSubmitting, setIsNamingSubmitting] = useState(false);

  // --- ログインボーナス State ---
  const [loginBonusState, setLoginBonusState] = useState({
    days: 0,
    gotBonus: false,
    showModal: false,
  });

  const [hungerPercent, setHungerPercent] = useState(100);
  const [motivationPercent, setMotivationPercent] = useState(100);
  const [actionAnim, setActionAnim] = useState<string | null>(null);
  const [gameOverNotice, setGameOverNotice] = useState<string | null>(null);
  const [gameOverHandled, setGameOverHandled] = useState(false);

  // --- AR・カメラ制御 ＆ スポット機能 State ---
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prevLocation, setPrevLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [activeLandmark, setActiveLandmark] = useState<any | null>(null);
  const [isSpotMapOpen, setIsSpotMapOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [sceneKey, setSceneKey] = useState(0);

  const targetDistanceToHatch = 1200;
  const targetFeedCount = 3;
  const targetLandmarkVisits = 2;
  const targetEventCount = 1;

  // 1歩 = 約0.75m として歩数を計算
  const stepCount = Math.floor(walkDistance / 0.75);

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

  // ==========================================
  //  Auth & Profile チェック (初回ログイン時)
  // ==========================================
  useEffect(() => {
    const initAuthAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const userId = session.user.id;
      setSessionUserId(userId);

      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();
      
      if (!profile || !profile.birth_year) {
        setShowProfileSetup(true);
      } else {
        await checkLoginBonus(userId, profile);
      }
    };
    initAuthAndProfile();
  }, [supabase, router]); 

  // --- ログインボーナス処理用関数 ---
  const grantLoginBonusItem = async (userId: string) => {
    let { data: item } = await supabase.from('item_masters').select('id').eq('name', 'ログボご飯').maybeSingle();
    
    if (!item) {
      const { data: newItem, error } = await supabase.from('item_masters')
        .insert({
          name: 'ログボご飯',
          description: '7日間ログインしたご褒美！普通のご飯より少し多くやる気が回復する特別なおご飯。',
          item_type: 'food',
          price_jpy: 0,
          effect_value: 15, 
          image_url: null 
        })
        .select('id').single();
      
      if (error) return;
      item = newItem;
    }

    const { data: inventoryItem } = await supabase.from('user_inventory')
      .select('id, quantity').eq('user_id', userId).eq('item_id', item.id).maybeSingle();

    if (inventoryItem) {
      await supabase.from('user_inventory').update({ quantity: inventoryItem.quantity + 1 }).eq('id', inventoryItem.id);
    } else {
      await supabase.from('user_inventory').insert({ user_id: userId, item_id: item.id, quantity: 1 });
    }
    
    const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', userId).gt('quantity', 0);
    if (inv) setInventory(inv);
  };

  const checkLoginBonus = async (userId: string, profile: any) => {
    const today = new Date().toLocaleDateString('sv-SE'); 
    const lastLoginDate = profile.last_login_date;
    let currentLoginDays = profile.login_days || 0;

    if (lastLoginDate !== today) {
      currentLoginDays = (currentLoginDays >= 7) ? 1 : currentLoginDays + 1;
      
      let gotBonus = false;
      if (currentLoginDays === 7) {
        await grantLoginBonusItem(userId);
        gotBonus = true;
      }

      await supabase.from('user_profiles').update({
        last_login_date: today,
        login_days: currentLoginDays
      }).eq('id', userId);

      setLoginBonusState({
        days: currentLoginDays,
        gotBonus: gotBonus,
        showModal: true
      });
      playSound('levelup'); 
    }
  };

  // --- データベースからのユーザーペット取得 ---
  useEffect(() => {
    const fetchGameData = async () => {
      if (!sessionUserId) return;

      const { data: items } = await supabase.from('item_masters').select('*').order('id', { ascending: false });
      if (items) setShopItems(items);
      const { data: spots } = await supabase.from('landmarks').select('*');
      if (spots) setLandmarks(spots);
      const { data: news } = await supabase.from('announcements').select('*').eq('is_active', true).order('published_at', { ascending: false });
      if (news) setNewsList(news);

      setGameOverNotice(null);
      setGameOverHandled(false);

      const { data: pet } = await supabase
        .from('pets')
        .select(`
          id, owner_id, affection_level, sleeping_until, last_fed_at, 
          is_egg, walk_distance_m, level, exp, custom_name, birthday,
          pet_masters(name, model_url, model_url_v2, model_url_v3, rarity, egg_type)
        `)
        .eq('owner_id', sessionUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pet) {
        setPetId(pet.id); setOwnerId(pet.owner_id); setAffection(pet.affection_level || 0); 
        setSleepingUntil(pet.sleeping_until); setLastFedAt(pet.last_fed_at); 
        setIsEgg(pet.is_egg); setWalkDistance(pet.walk_distance_m || 0); setLevel(pet.level || 1);
        setExp(pet.exp || 0); setCustomName(pet.custom_name); setBirthday(pet.birthday);
        setIsEggUnregistered(false); 

        if (pet.pet_masters) { 
          const pm = (pet.pet_masters && pet.pet_masters[0] ? pet.pet_masters[0] : pet.pet_masters) || {};
          const rarityPm = (pm as any).rarity || '?';
          const fallbackBase = `/models/pet/${rarityPm}`;
          
          setPetModelUrlV1((pm as any).model_url || `${fallbackBase}/v1.glb`);
          setPetModelUrlV2((pm as any).model_url_v2 || `${fallbackBase}/v2.glb`);
          setPetModelUrlV3((pm as any).model_url_v3 || `${fallbackBase}/v3.glb`);
          setPetMasterName((pm as any).name || '不明');
          setPetRarity(rarityPm);

          const eggGroup = (pm as any).egg_type || 'A'; 
          setEggModelUrl(`/models/eggs/egg_${eggGroup}.glb`);
        }

        const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', sessionUserId).gt('quantity', 0);
        if (inv) setInventory(inv);

        const { count: feedLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'feed');
        if (feedLogCount !== null) setFeedCount(feedLogCount);
        const { count: eventLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'event');
        if (eventLogCount !== null) setEventCount(eventLogCount);
        const { count: landmarkCount } = await supabase.from('landmark_visits').select('id', { count: 'exact', head: true }).eq('user_id', sessionUserId);
        if (landmarkCount !== null) setLandmarkVisitCount(landmarkCount);

      } else {
        setIsEggUnregistered(true); 
        setIsEgg(true); 
        setEggModelUrl('/models/eggs/egg_A.glb');
      }
    };
    fetchGameData();
  }, [sessionUserId, supabase]);

  const getCurrentModelUrl = () => {
    if (isEgg || isEggUnregistered) return eggModelUrl;
    if (level >= 10 && petModelUrlV3) return petModelUrlV3;
    if (level >= 5 && petModelUrlV2) return petModelUrlV2;
    return petModelUrlV1;
  };
  const activeModelUrl = getCurrentModelUrl();
  const isSleeping = sleepingUntil ? new Date(sleepingUntil) > new Date() : false;
  const displayName = customName || petMasterName || '名無し';

  const getLevelRequirement = (levelNumber: number) => ({
    distance: targetDistanceToHatch * levelNumber,
    feed: targetFeedCount * levelNumber,
    landmark: targetLandmarkVisits * levelNumber,
    event: targetEventCount * levelNumber,
  });

  const hatchProgress = {
    distance: Math.min(1, walkDistance / targetDistanceToHatch),
    feed: Math.min(1, feedCount / targetFeedCount),
    landmark: Math.min(1, landmarkVisitCount / targetLandmarkVisits),
    event: Math.min(1, eventCount / targetEventCount),
  };
  const isHatchReady = !isEggUnregistered && isEgg && petId && hatchProgress.distance >= 1 && hatchProgress.feed >= 1 && hatchProgress.landmark >= 1 && hatchProgress.event >= 1;
  const nextLevelRequirements = getLevelRequirement(level);
  const isNextLevelReady = !isEgg && petId && walkDistance >= nextLevelRequirements.distance && feedCount >= nextLevelRequirements.feed && landmarkVisitCount >= nextLevelRequirements.landmark && eventCount >= nextLevelRequirements.event;
  const expNeededForNextLevel = level * 150;

  const resetPetToEgg = async (reason: string) => {
    if (!petId || isEgg || gameOverHandled) return;

    try {
      await supabase.from('pets').update({
        is_egg: true,
        walk_distance_m: 0,
        level: 1,
        exp: 0,
        affection_level: 0,
        sleeping_until: null,
        last_fed_at: null,
        custom_name: null,
        birthday: null,
      }).eq('id', petId);

      await supabase.from('activity_logs').insert({
        pet_id: petId,
        action_type: 'game_over',
        points_earned: 0,
      });

      setIsEgg(true);
      setWalkDistance(0);
      setFeedCount(0);
      setLandmarkVisitCount(0);
      setEventCount(0);
      setLevel(1);
      setExp(0);
      setAffection(0);
      setSleepingUntil(null);
      setLastFedAt(null);
      setHungerPercent(100);
      setMotivationPercent(100);
      setCustomName(null);
      setBirthday(null);
      setPetModelUrlV2(null);
      setPetModelUrlV3(null);
      setGameOverHandled(true);
      setGameOverNotice(`💀 ${reason}\n卵に戻ってしまった…もう一度育て直そう！`);
      playSound('error');
    } catch (error) {
      console.error('ゲームオーバー処理に失敗しました', error);
    }
  };

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

  useEffect(() => {
    if (!petId || isEgg || !lastFedAt || gameOverHandled) return;

    const now = Date.now();
    const lastFedTime = new Date(lastFedAt).getTime();
    const hoursPassed = (now - lastFedTime) / (1000 * 60 * 60);

    if (hoursPassed >= 24) {
      void resetPetToEgg('体力が尽きて24時間が経過したため');
    }
  }, [petId, lastFedAt, isEgg, gameOverHandled]);

  const getCurrentMood = () => {
    if (isEgg || isEggUnregistered) return { text: '🥚 卵', color: 'bg-gray-500', clip: 'Idle' };
    if (isSleeping) return { text: '💤 爆睡中', color: 'bg-blue-600', clip: 'Sleep' };
    if (hungerPercent <= 30) return { text: '💢 はらぺこ', color: 'bg-red-600', clip: 'Angry' };
    if (motivationPercent <= 30) return { text: '💧 しょんぼり', color: 'bg-blue-400', clip: 'Sad' };
    if (motivationPercent >= 80) return { text: '✨ 絶好調！', color: 'bg-pink-500', clip: 'Happy' };
    return { text: '😐 おだやか', color: 'bg-green-500', clip: 'Idle' };
  };
  const currentMood = getCurrentMood();

  // --- 孵化エフェクト表示ロジック ---
  const showHatchEffect = (rarity: string) => {
    return new Promise<void>((resolve) => {
      const multiplier = rarity === 'UR' ? 3 : rarity === 'SR' ? 2 : rarity === 'R' ? 1.5 : 1;
      const base = 12;
      const count = Math.min(120, Math.floor(base * multiplier * (rarity === 'UR' ? 2.5 : 1)));
      const colors = {
        N: ['#E5E7EB', '#F9FAFB'],
        R: ['#FDE68A', '#FCA5A5', '#FBCFE8'],
        SR: ['#C7A3FF', '#FDE68A', '#FECACA', '#A7F3D0'],
        UR: ['#FFD700', '#FF73FA', '#7CF0FF', '#FF9F1C']
      } as Record<string, string[]>;

      const particles = Array.from({ length: count }).map((_, i) => {
        const angle = (Math.random() - 0.5) * Math.PI * 2;
        const distance = 80 + Math.random() * (rarity === 'UR' ? 360 : rarity === 'SR' ? 260 : rarity === 'R' ? 180 : 120);
        return {
          id: `${Date.now()}_${i}`,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - (Math.random() * 80),
          color: (colors[rarity as keyof typeof colors] || colors.N)[Math.floor(Math.random() * ((colors[rarity as keyof typeof colors] || colors.N).length))],
          size: 6 + Math.random() * (rarity === 'UR' ? 12 : rarity === 'SR' ? 10 : 6),
          duration: 700 + Math.random() * (rarity === 'UR' ? 1200 : 800)
        };
      });

      setHatchOverlay({ active: true, particles, rarity });
      setTimeout(() => {
        setHatchOverlay(prev => prev ? { ...prev, particles: prev.particles.map(p => ({ ...p, launched: true })) } : prev);
      }, 40);

      const maxDuration = Math.max(...particles.map(p => p.duration)) + 300;
      setTimeout(() => {
        setHatchOverlay(null);
        resolve();
      }, maxDuration);
    });
  };

  // --- 🌟 レベルアップ演出用エフェクトロジック ---
  const showLevelUpEffect = (newLevel: number) => {
    return new Promise<void>((resolve) => {
      // 5の倍数をキリ番（マイルストーン）として判定
      const isMilestone = newLevel % 5 === 0;
      const count = isMilestone ? 150 : 50;
      
      const colors = isMilestone
        ? ['#FFD700', '#FF73FA', '#7CF0FF', '#FF9F1C', '#FFFFFF'] // キリ番は豪華な色
        : ['#60A5FA', '#34D399', '#FBBF24']; // 通常レベルアップ

      const particles = Array.from({ length: count }).map((_, i) => {
        const angle = (Math.random() - 0.5) * Math.PI * 2;
        const distance = isMilestone ? 150 + Math.random() * 250 : 80 + Math.random() * 150;
        return {
          id: `lvl_${Date.now()}_${i}`,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - (Math.random() * 100),
          color: colors[Math.floor(Math.random() * colors.length)],
          size: isMilestone ? 8 + Math.random() * 12 : 6 + Math.random() * 8,
          duration: isMilestone ? 1000 + Math.random() * 1500 : 700 + Math.random() * 800
        };
      });

      setLevelUpOverlay({ active: true, particles, level: newLevel, isMilestone });
      
      setTimeout(() => {
        setLevelUpOverlay(prev => prev ? { ...prev, particles: prev.particles.map(p => ({ ...p, launched: true })) } : prev);
      }, 40);

      const maxDuration = Math.max(...particles.map(p => p.duration)) + 300;
      setTimeout(() => {
        setLevelUpOverlay(null);
        resolve();
      }, maxDuration);
    });
  };

  const addExperience = async (amount: number) => {
    if (!petId) return;
    let newExp = exp + amount; let newLevel = level; let leveledUp = false;
    const expNeeded = newLevel * 150;
    const nextRequirements = getLevelRequirement(newLevel);
    if (newExp >= expNeeded) {
      if (walkDistance >= nextRequirements.distance && feedCount >= nextRequirements.feed && landmarkVisitCount >= nextRequirements.landmark && eventCount >= nextRequirements.event) {
        newExp -= expNeeded; newLevel += 1; leveledUp = true;
      } else {
        setExp(newExp);
        await supabase.from('pets').update({ exp: newExp }).eq('id', petId);
        return alert(`🌱 もうすぐレベルアップ！ でもまだ条件が揃っていません。
必要: 歩行 ${nextRequirements.distance}m / 給餌 ${nextRequirements.feed}回 / ランドマーク ${nextRequirements.landmark}回 / イベント ${nextRequirements.event}回`);
      }
    }
    setExp(newExp); setLevel(newLevel);
    await supabase.from('pets').update({ exp: newExp, level: newLevel }).eq('id', petId);
    
    // レベルアップした時の処理
    if (leveledUp) {
      playSound('levelup'); 
      await showLevelUpEffect(newLevel); // 🌟 レベルアップエフェクトの呼び出し
      
      alert(`🌟 レベルアップ！ Lv.${newLevel} になりました！`);
      if (newLevel === 5 && petModelUrlV2) alert('体が大きくなったみたい…！');
      if (newLevel === 10 && petModelUrlV3) alert('姿が大きく変わった…！');
    }
  };

  useEffect(() => {
    if (viewMode === 'gps' && navigator.geolocation) {
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
      setActiveLandmark(landmarks.find(lm => getDistance(location.lat, location.lng, lm.latitude, lm.longitude) <= lm.radius_meters) || null);
    }
  }, [location, landmarks, viewMode]);

  useEffect(() => {
    if (viewMode === 'mindar' && petId && !isEgg && !isSleeping) {
      const petModel = document.querySelector('#pet-model');
      const handlePetTap = () => {
        playSound('tap');
        setAffection(prev => { const val = prev + 1; supabase.from('pets').update({ affection_level: val }).eq('id', petId).then(); return val; });
        setEventCount(prev => prev + 1);
        supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'event', points_earned: 5 }).then();
        
        // 🌟 タップ時のリアクションとして Jump, Fly, Happy をランダムで再生
        const tapActions = ['Jump', 'Fly', 'Happy'];
        const randomAction = tapActions[Math.floor(Math.random() * tapActions.length)];
        setActionAnim(randomAction); 
        setTimeout(() => setActionAnim(null), 1500);
        
        addExperience(5); 
      };
      petModel?.addEventListener('click', handlePetTap);
      return () => petModel?.removeEventListener('click', handlePetTap);
    }
  }, [viewMode, isClient, petId, supabase, isEgg, isSleeping, sceneKey]);

  const handleCreateEgg = async () => {
    if (!sessionUserId) return;
    try {
      const result = await hatchPet('random_encounter'); 
      if (result.success) {
        setPetId(result.pet.id); setOwnerId(result.pet.owner_id); 
        setIsEgg(true); setIsEggUnregistered(false); setWalkDistance(0); setFeedCount(0); setLandmarkVisitCount(0); setEventCount(0);
        setGameOverNotice(null); setGameOverHandled(false); setLastFedAt(null); setSleepingUntil(null); setHungerPercent(100); setMotivationPercent(100); setLevel(1); setExp(0); setAffection(0);
        
        if (result.pet.pet_masters) {
          const pm = result.pet.pet_masters;
          const eggGroup = (pm as any).egg_type || 'A';
          setEggModelUrl(`/models/eggs/egg_${eggGroup}.glb`);

          const rarityRes = pm.rarity || '?';
          const fallbackBase = `/models/pet/${rarityRes}`;
          setPetModelUrlV1(pm.model_url || `${fallbackBase}/v1.glb`);
          setPetModelUrlV2(pm.model_url_v2 || `${fallbackBase}/v2.glb`);
          setPetModelUrlV3(pm.model_url_v3 || `${fallbackBase}/v3.glb`);
          setPetMasterName(pm.name || '不明');
          setPetRarity(rarityRes);
        } else {
          setEggModelUrl(`/models/eggs/egg_A.glb`);
        }
        
        playSound('item');
        alert(`不思議な卵を拾った！\nさんぽ、給餌、ランドマーク、イベントの全てをこなして孵化させよう！`);
      }
    } catch (err) { alert('エラーが発生しました。'); }
  };

  const handleHatchEgg = async () => {
    if (!petId) return;
    if (!isHatchReady) {
      return alert('まだ孵化条件が揃っていません。歩数・給餌・ランドマーク・イベントを全て満たしてから試してください。');
    }
    playSound('hatch');
    try {
      await showHatchEffect(petRarity);
    } catch (e) {
    }

    setIsEgg(false);
    setSceneKey(prev => prev + 1);
    setHatchAnimating(true);
    if (petRarity === 'SR' || petRarity === 'UR') playSound('levelup');
    
    setTimeout(async () => {
      const today = new Date().toISOString().split('T')[0];
      setBirthday(today); setLastFedAt(new Date().toISOString());
      await supabase.from('pets').update({ is_egg: false, last_fed_at: new Date().toISOString(), birthday: today }).eq('id', petId);
      setHatchAnimating(false);
      
      setShowNamingScreen(true);
    }, 900);
  };

  const handleFeed = async () => {
    if (!petId || isSleeping) return;
    playSound('eat'); 
    setActionAnim('Eat'); // 🌟 食事のアニメーション
    setTimeout(() => setActionAnim(null), 2000);
    setFeedCount(prev => prev + 1);
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'feed', points_earned: 10 });
    if (!isEgg) {
      const now = new Date().toISOString(); setLastFedAt(now); setHungerPercent(100);
      await supabase.from('pets').update({ last_fed_at: now }).eq('id', petId);
    }
    addExperience(20);
  };

  const handleUseItem = async (invItem: any) => {
    if (!petId || isSleeping) return;
    const item = invItem.item_masters; setIsInventoryOpen(false); playSound('item');
    setInventory(prev => prev.map(i => i.id === invItem.id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
    await supabase.from('user_inventory').update({ quantity: invItem.quantity - 1 }).eq('id', invItem.id);

    if (item.item_type === 'food') {
      const newAffection = affection + item.effect_value; const now = new Date().toISOString();
      setAffection(newAffection); setLastFedAt(now); setHungerPercent(100); setFeedCount(prev => prev + 1);
      await supabase.from('pets').update({ affection_level: newAffection, last_fed_at: now }).eq('id', petId);
      await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'feed', points_earned: item.effect_value || 20 });
      setActionAnim('Eat'); setTimeout(() => setActionAnim(null), 2000); addExperience(50); alert(`✨ ${item.name} をあげました！`);
    } else if (item.item_type === 'sleep') {
      const sleepEnd = new Date(); sleepEnd.setHours(sleepEnd.getHours() + item.effect_value);
      setSleepingUntil(sleepEnd.toISOString());
      await supabase.from('pets').update({ sleeping_until: sleepEnd.toISOString() }).eq('id', petId);
      alert(`💤 ペットは ${item.effect_value} 時間眠りにつきました。`);
    }
  };

  const handleBuyItem = async (shopItem: any) => {
    if (!sessionUserId) return;
    const confirmBuy = window.confirm(`${shopItem.name} を ¥${shopItem.price_jpy} で購入しますか？`);
    if (!confirmBuy) return;

    try {
      playSound('item');
      const existingItem = inventory.find(i => i.item_masters.id === shopItem.id);
      if (existingItem) {
        await supabase.from('user_inventory').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
      } else {
        await supabase.from('user_inventory').insert({ user_id: sessionUserId, item_id: shopItem.id, quantity: 1 });
      }
      const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', sessionUserId).gt('quantity', 0);
      if (inv) setInventory(inv); alert('🛍️ 購入しました！「もちもの」から使用できます。');
    } catch (e) { alert('エラーが発生しました'); }
  };

  const handleCheckIn = async () => {
    if (!activeLandmark || !petId || !sessionUserId) return;
    const today = new Date().toLocaleDateString('sv-SE'); 
    const { error: visitError } = await supabase.from('landmark_visits').insert({ user_id: sessionUserId, landmark_id: activeLandmark.id, visited_date: today });
    if (visitError) return alert('今日は既に訪問済みです！');
    
    setLandmarkVisitCount(prev => prev + 1);
    playSound('levelup');
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'landmark_visit', points_earned: activeLandmark.bonus_points });
    addExperience(100); alert(`🎉 ${activeLandmark.name} で ${activeLandmark.bonus_points} ポイント獲得！\n経験値が大幅にアップ！`);
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

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) {
      alert('セッションが見つかりません。再度ログインしてください。');
      return;
    }

    const birthYear = parseInt(inputBirthYear, 10);
    if (Number.isNaN(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear()) {
      alert('正しい誕生年を入力してください。');
      return;
    }

    if (!inputGender) {
      alert('性別を選択してください。');
      return;
    }

    setIsSetupSubmitting(true);
    try {
      const today = new Date().toLocaleDateString('sv-SE');
      const { error } = await supabase.from('user_profiles').upsert({
        id: sessionUserId,
        birth_year: birthYear,
        gender: inputGender,
        email_notify_feed: true,
        email_notify_news: true,
        last_login_date: today,
        login_days: 1
      }, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      setShowProfileSetup(false);
      alert('プロフィールを設定しました！');

      setLoginBonusState({
        days: 1,
        gotBonus: false,
        showModal: true
      });
      playSound('levelup');
      router.refresh();

    } catch (err: any) {
      console.error('プロフィール保存エラー', err);
      alert(err?.message || 'エラーが発生しました。');
    } finally {
      setIsSetupSubmitting(false);
    }
  };

  const handleNamingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petId || !namingInput.trim()) return;
    
    setIsNamingSubmitting(true);
    try {
      await supabase.from('pets').update({ custom_name: namingInput.trim() }).eq('id', petId);
      setCustomName(namingInput.trim());
      setShowNamingScreen(false);
      playSound('levelup');
      alert(`これからよろしくね、${namingInput.trim()}！\n（誕生日は今日の日付で記録されました）`);
    } catch (err) {
      console.error('名付けエラー', err);
      alert('エラーが発生しました。');
    } finally {
      setIsNamingSubmitting(false);
    }
  };

  if (!isClient) return <div className="bg-black w-full h-full"></div>;

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <Script src="https://aframe.io/releases/1.5.0/aframe.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.2.0/dist/aframe-extras.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js" strategy="beforeInteractive" />
      <Script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar-nft.js" strategy="beforeInteractive" />

      {/* --- レベルアップエフェクトオーバーレイ --- */}
      {levelUpOverlay?.active && (
        <div className="pointer-events-none fixed inset-0 z-[140] overflow-hidden flex items-center justify-center">
          {levelUpOverlay.particles.map((p: any) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: p.size,
                height: p.size,
                background: p.color,
                borderRadius: '50%',
                transform: p.launched ? `translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) scale(1) rotate(${Math.random() * 360}deg)` : 'translate(-50%,-50%) scale(0.2)',
                opacity: p.launched ? 0 : 1,
                transition: `transform ${p.duration}ms cubic-bezier(.2,.8,.2,1), opacity ${p.duration}ms linear`
              }}
            />
          ))}
          <div className="absolute text-center drop-shadow-2xl animate-bounce">
            <div className={`font-black italic tracking-wider ${levelUpOverlay.isMilestone ? 'text-6xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : 'text-5xl text-yellow-300 drop-shadow-md'}`}>
              LEVEL UP!
            </div>
            <div className="text-white text-3xl font-bold mt-2">
              Lv. {levelUpOverlay.level}
            </div>
          </div>
        </div>
      )}

      {/* --- 孵化エフェクトオーバーレイ --- */}
      {hatchOverlay?.active && (
        <div className="pointer-events-none fixed inset-0 z-[130] overflow-hidden">
          {hatchOverlay.particles.map((p: any) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: p.size,
                height: p.size,
                background: p.color,
                borderRadius: '50%',
                transform: p.launched ? `translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) scale(1)` : 'translate(-50%,-50%) scale(0.2)',
                opacity: p.launched ? 0 : 1,
                transition: `transform ${p.duration}ms cubic-bezier(.2,.8,.2,1), opacity ${p.duration}ms linear`
              }}
            />
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white drop-shadow-2xl pointer-events-none">
            <div className="text-3xl font-extrabold">{hatchOverlay.rarity === 'UR' ? '🌈 UR!' : hatchOverlay.rarity === 'SR' ? '✨ SR' : hatchOverlay.rarity === 'R' ? '⭐ R' : 'N'}</div>
          </div>
        </div>
      )}

      {/* --- 初回プロフィール設定モーダル --- */}
      {showProfileSetup && (
        <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleProfileSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 relative">
            <h2 className="text-xl font-bold text-center border-b pb-3 text-slate-800">🎉 ようこそ Straid AR へ！</h2>
            <p className="text-xs text-gray-500 text-center mb-4">サービス向上のため、情報を教えてください</p>
            
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">あなたの誕生年</label>
                <input type="number" value={inputBirthYear} onChange={e => setInputBirthYear(e.target.value)} placeholder="1990" className="w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 text-black" required />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">性別</label>
                <select value={inputGender} onChange={e => setInputGender(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 text-black" required>
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

      {/* --- 名付け設定モーダル（孵化直後） --- */}
      {showNamingScreen && (
        <div className="absolute inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleNamingSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 relative">
            <h2 className="text-2xl font-bold text-center border-b pb-3 text-slate-800">✨ 誕生おめでとう！</h2>
            <p className="text-sm text-gray-600 text-center mb-4">新しく生まれたペットに<br/>名前をつけてあげましょう</p>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ペットの名前</label>
              <input type="text" value={namingInput} onChange={e => setNamingInput(e.target.value)} placeholder="例: ポチ" className="w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-pink-500 text-black" required />
            </div>
            
            <button disabled={isNamingSubmitting || !namingInput.trim()} className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold py-3 rounded-xl shadow-lg mt-4 disabled:bg-gray-400 transition-transform active:scale-95">
              {isNamingSubmitting ? '保存中...' : '名前を決定する！'}
            </button>
          </form>
        </div>
      )}

      {/* --- スポットマップ確認モーダル（レーダー） --- */}
      {isSpotMapOpen && (
        <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-center border-b pb-3 mb-4 text-slate-800">🗺️ 周辺のスポット</h2>
            
            {!location ? (
              <p className="text-center text-gray-500 my-10">GPS座標を取得中...</p>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1">
                {/* 視覚的レーダーマップ */}
                <div className="relative w-full aspect-square bg-green-50 rounded-2xl border-4 border-green-200 overflow-hidden mb-4 shadow-inner">
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-full h-px bg-green-200"></div>
                     <div className="absolute h-full w-px bg-green-200"></div>
                     {/* ユーザー現在地 */}
                     <div className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white z-10 shadow-md animate-pulse"></div>
                  </div>
                  {/* 周辺スポットのピン表示 */}
                  {landmarks.map(spot => {
                     const dLat = (spot.latitude - location.lat) * 111000;
                     const dLng = (spot.longitude - location.lng) * 91000;
                     const scale = 0.05; 
                     const top = `calc(50% - ${dLat * scale}px)`;
                     const left = `calc(50% + ${dLng * scale}px)`;
                     return (
                       <div key={`radar-${spot.id}`} className="absolute w-8 h-8 -ml-4 -mt-4 text-xl flex items-center justify-center filter drop-shadow z-0" style={{ top, left }} title={spot.name}>📍</div>
                     )
                  })}
                </div>
                
                {/* スポットリスト */}
                <div className="space-y-3">
                  {landmarks.map(spot => {
                    const dist = getDistance(location.lat, location.lng, spot.latitude, spot.longitude);
                    return (
                      <div key={`list-${spot.id}`} className="bg-gray-50 border rounded-xl p-3 flex justify-between items-center shadow-sm">
                        <div>
                           <div className="font-bold text-gray-800">{spot.name}</div>
                           <div className="text-xs text-gray-500">現在地から約 {Math.floor(dist)}m</div>
                        </div>
                        <button onClick={() => { 
                          setViewMode('gps'); 
                          setIsSpotMapOpen(false); 
                          setCameraFacing('environment'); 
                          playSound('tap');
                        }} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform">
                          ARで見る
                        </button>
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

      {/* --- ウィークリーログインボーナス モーダル --- */}
      {loginBonusState.showModal && (
        <div className="absolute inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center animate-bounce text-black">
            <h2 className="text-xl font-bold text-center mb-2 text-slate-800">🎁 ログインボーナス</h2>
            <p className="text-sm text-gray-600 mb-6 text-center">毎日ログインしてアイテムをゲットしよう！</p>
            
            <div className="grid grid-cols-4 gap-3 mb-6 w-full">
              {[1, 2, 3, 4, 5, 6].map(day => (
                <div key={day} className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 ${loginBonusState.days >= day ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className="text-[10px] font-bold text-gray-500 mb-1">{day}日目</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${loginBonusState.days >= day ? 'bg-orange-400 text-white' : 'bg-gray-200 text-transparent'}`}>✓</div>
                </div>
              ))}
              <div className={`col-span-2 flex flex-col items-center justify-center py-2 rounded-xl border-2 ${loginBonusState.days >= 7 ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-gray-50'}`}>
                 <span className="text-[10px] font-bold text-gray-500 mb-1">7日目 (ボーナス!)</span>
                 <div className={`text-3xl ${loginBonusState.days >= 7 ? 'opacity-100 drop-shadow-md' : 'opacity-30 grayscale'}`}>🎁</div>
              </div>
            </div>

            {loginBonusState.gotBonus && (
              <div className="bg-pink-100 text-pink-800 p-3 rounded-xl font-bold w-full text-center mb-4 text-sm shadow-inner">
                ✨「ログボご飯」をゲットしました！✨<br/><span className="text-xs font-normal">もちものから使ってみよう！</span>
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

      {/* --- UIレイヤー (ヘッダー) --- */}
      {sessionUserId && (
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none">
          <div className="flex justify-between items-end">
            <span className="text-white font-bold text-2xl drop-shadow-lg">{isEggUnregistered ? '謎のNFCタグ' : displayName}</span>
            <span className={`${currentMood.color} text-white px-3 py-1.5 rounded-lg font-bold shadow-md text-sm transition-colors duration-300`}>{currentMood.text}</span>
          </div>

          {(isEgg && !isEggUnregistered) && (
            <div className="bg-black/80 p-4 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-yellow-500 space-y-3">
              <div className="flex justify-between text-xs font-bold text-yellow-400">
                <span>🥚 孵化条件</span>
                <span>{isHatchReady ? '準備完了！' : 'あと少し...'}</span>
              </div>
              <div className="space-y-2 text-xs text-white">
                <div className="flex justify-between">
                  <span>🚶 歩行 {Math.floor(walkDistance)} / {targetDistanceToHatch}m <span className="text-[10px] text-gray-300 ml-1">(約{stepCount}歩)</span></span>
                  <span>{Math.floor(hatchProgress.distance * 100)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${Math.min(100, hatchProgress.distance * 100)}%` }}></div></div>
                <div className="flex justify-between"><span>🍚 給餌 {feedCount} / {targetFeedCount}回</span><span>{Math.floor(hatchProgress.feed * 100)}%</span></div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-orange-400 transition-all duration-500" style={{ width: `${Math.min(100, hatchProgress.feed * 100)}%` }}></div></div>
                <div className="flex justify-between"><span>📍 ランドマーク {landmarkVisitCount} / {targetLandmarkVisits}回</span><span>{Math.floor(hatchProgress.landmark * 100)}%</span></div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${Math.min(100, hatchProgress.landmark * 100)}%` }}></div></div>
                <div className="flex justify-between"><span>✨ イベント {eventCount} / {targetEventCount}回</span><span>{Math.floor(hatchProgress.event * 100)}%</span></div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-pink-400 transition-all duration-500" style={{ width: `${Math.min(100, hatchProgress.event * 100)}%` }}></div></div>
              </div>
            </div>
          )}

          {(!isEgg && !isEggUnregistered && petId) && (
            <>
              <div className="bg-black/60 p-2.5 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-gray-700">
                <div className="flex justify-between text-xs font-bold text-white mb-1.5"><span>🍖 体力</span><span>{hungerPercent}%</span></div>
                <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-1000 ${hungerPercent < 30 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${hungerPercent}%` }}></div></div>
              </div>
              <div className="bg-black/60 p-2.5 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-gray-700">
                <div className="flex justify-between text-xs font-bold text-white mb-1.5"><span>💖 ごきげん</span><span>{motivationPercent}%</span></div>
                <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-1000" style={{ width: `${motivationPercent}%` }}></div></div>
              </div>
              <div className="bg-black/60 p-2.5 rounded-xl backdrop-blur-sm shadow-lg pointer-events-auto border border-blue-500">
                <div className="flex justify-between text-xs font-bold text-blue-200 mb-1.5"><span>🌟 Lv.{level}</span><span>EXP: {exp} / {expNeededForNextLevel}</span></div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(exp / expNeededForNextLevel) * 100}%` }}></div></div>
              </div>
              <div className="bg-black/70 p-3 rounded-xl shadow-lg pointer-events-auto border border-indigo-500 space-y-3 text-xs text-white">
                <div className="flex justify-between">
                  <span>🚶 次の条件 {Math.floor(walkDistance)} / {nextLevelRequirements.distance}m <span className="text-[10px] text-gray-300 ml-1">(約{stepCount}歩)</span></span>
                  <span>{Math.floor(Math.min(100, (walkDistance / nextLevelRequirements.distance) * 100))}%</span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-400 transition-all duration-500" style={{ width: `${Math.min(100, (walkDistance / nextLevelRequirements.distance) * 100)}%` }}></div></div>
                <div className="flex justify-between"><span>🍚 給餌</span><span>{feedCount} / {nextLevelRequirements.feed}</span></div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-orange-400 transition-all duration-500" style={{ width: `${Math.min(100, (feedCount / nextLevelRequirements.feed) * 100)}%` }}></div></div>
                <div className="flex justify-between"><span>📍 ランドマーク</span><span>{landmarkVisitCount} / {nextLevelRequirements.landmark}</span></div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${Math.min(100, (landmarkVisitCount / nextLevelRequirements.landmark) * 100)}%` }}></div></div>
                <div className="flex justify-between"><span>✨ イベント</span><span>{eventCount} / {nextLevelRequirements.event}</span></div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-pink-400 transition-all duration-500" style={{ width: `${Math.min(100, (eventCount / nextLevelRequirements.event) * 100)}%` }}></div></div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- 右上ボタン群 --- */}
      <div className="absolute top-48 right-4 z-40 flex flex-col gap-4 pointer-events-auto">
        <button onClick={() => { setIsNewsOpen(true); playSound('tap'); }} className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 flex items-center justify-center w-14 h-14 relative" aria-label="お知らせ">
          <span className="text-2xl">📢</span>{newsList.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>}
        </button>

        {viewMode === 'gps' && activeLandmark ? (
          <>
            <button 
              onClick={() => { setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment'); setSceneKey(k => k + 1); playSound('tap'); }} 
              className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14" 
              aria-label="カメラ切替"
            >
              <span className="text-2xl">🔄</span>
            </button>
            <button 
              onClick={takeSnapshot} 
              className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14" 
              aria-label="写真を撮る"
            >
              <span className="text-2xl">📸</span>
            </button>
          </>
        ) : viewMode === 'mindar' ? (
           <button onClick={takeSnapshot} className="bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14" aria-label="写真を撮る">
             <span className="text-2xl">📸</span>
           </button>
        ) : null}
      </div>

      {gameOverNotice && (
        <div className="absolute inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4">
            <div className="text-4xl">💀</div>
            <h2 className="text-xl font-bold text-red-600">ゲームオーバー</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{gameOverNotice}</p>
            <button onClick={() => setGameOverNotice(null)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg">卵を確認する</button>
          </div>
        </div>
      )}

      {/* --- UIレイヤー (ボトム) --- */}
      <div className="absolute z-10 bottom-0 w-full p-4 flex flex-col gap-4 pointer-events-auto">
        
        {isShopOpen && (
          <div className="absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b pb-3"><h3 className="font-bold text-xl text-gray-800">🛒 おみせ</h3><button onClick={() => setIsShopOpen(false)} className="text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200">閉じる</button></div>
            {shopItems.length === 0 ? ( <p className="text-gray-500 text-center py-8">現在販売中のアイテムはありません</p> ) : (
              <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {shopItems.map((item) => (
                  <div key={item.id} className="bg-white border rounded-2xl p-3 flex flex-col shadow-sm">
                    {item.image_url ? ( <img src={item.image_url} alt={item.name} className="w-full h-24 object-cover rounded-xl mb-2 bg-gray-100" /> ) : ( <div className="w-full h-24 bg-blue-50 rounded-xl mb-2 flex items-center justify-center text-3xl">🎁</div> )}
                    <h4 className="font-bold text-gray-800 text-sm leading-tight mb-1">{item.name}</h4>
                    <span className="text-[10px] text-gray-500 mb-2 line-clamp-2 leading-tight">{item.description}</span>
                    <div className="mt-auto flex items-center justify-between"><span className="font-bold text-blue-600 text-sm">¥{item.price_jpy}</span><button onClick={() => handleBuyItem(item)} className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95">購入</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isInventoryOpen && (
          <div className="absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b pb-3"><h3 className="font-bold text-xl text-gray-800">🎒 もちもの</h3><button onClick={() => setIsInventoryOpen(false)} className="text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200">閉じる</button></div>
            {inventory.length === 0 ? ( <p className="text-gray-500 text-center py-8">アイテムを持っていません。</p> ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {inventory.map((invItem) => (
                  <button key={invItem.id} onClick={() => handleUseItem(invItem)} className="flex-shrink-0 bg-white border border-blue-100 rounded-2xl p-3 w-32 flex flex-col text-left shadow-sm active:scale-95 transition-transform">
                    {invItem.item_masters.image_url ? ( <img src={invItem.item_masters.image_url} className="w-full h-16 object-cover rounded-lg mb-2" /> ) : ( <div className="w-full h-16 bg-blue-50 rounded-lg mb-2 flex items-center justify-center text-2xl">📦</div> )}
                    <div className="font-bold text-blue-900 text-sm truncate">{invItem.item_masters.name}</div><div className="mt-auto text-right text-xs font-bold text-blue-600 pt-2">所持: {invItem.quantity}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'mindar' && isEggUnregistered && sessionUserId && (
          <button onClick={handleCreateEgg} className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-2xl font-bold shadow-lg w-full animate-pulse text-lg border-4 border-yellow-200">🥚 不思議な卵を発見！<br/><span className="text-sm">タップして拾い上げる</span></button>
        )}

        {viewMode === 'mindar' && isEgg && !isEggUnregistered && isHatchReady && petId && (
          <button onClick={handleHatchEgg} className="bg-gradient-to-r from-pink-400 to-red-500 text-white p-4 rounded-2xl font-bold shadow-lg w-full animate-bounce text-lg border-4 border-pink-200">✨ 卵が割れそうだ！<br/><span className="text-sm">タップして孵化させる</span></button>
        )}

        {viewMode === 'mindar' && !isEgg && !isEggUnregistered && petId && (
          <div className="flex gap-2 w-full">
            <button onClick={handleFeed} disabled={isSleeping || hungerPercent === 100} className={`flex-[2] text-white py-3 rounded-2xl font-bold shadow-lg transition-all ${(isSleeping || hungerPercent === 100) ? 'bg-gray-400 opacity-80' : 'bg-gradient-to-br from-orange-400 to-orange-600 active:scale-95'}`}>🍚<br/><span className="text-xs">ごはん</span></button>
            <button onClick={() => { setIsInventoryOpen(true); setIsShopOpen(false); setIsNewsOpen(false); playSound('tap'); }} className="flex-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center">🎒<br/><span className="text-xs">もちもの</span></button>
            <button onClick={() => { setIsShopOpen(true); setIsInventoryOpen(false); setIsNewsOpen(false); playSound('tap'); }} className="flex-1 bg-gradient-to-br from-green-500 to-green-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center">🛒<br/><span className="text-xs">おみせ</span></button>
          </div>
        )}
        
        {viewMode === 'gps' && (
          <>
            <div className="bg-green-600/90 text-white p-3 rounded-xl font-bold shadow-lg w-full text-center text-sm backdrop-blur-sm">
              {location ? `🚶‍♂️ 現在地周辺を散歩中... ${petId ? `(歩行: ${Math.floor(walkDistance)}m / 約${stepCount}歩)` : ''}` : '📡 GPSを探索中...'}
            </div>
            {activeLandmark && !isEgg && petId && (
              <button onClick={handleCheckIn} className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 p-4 rounded-2xl font-bold shadow-2xl w-full border-4 border-yellow-200 animate-bounce text-lg">✨ 【{activeLandmark.name}】を発見！<br/>タップして経験値GET！</button>
            )}
          </>
        )}

        <button 
          onClick={() => { setIsSpotMapOpen(true); playSound('tap'); }} 
          className="bg-gradient-to-r from-teal-400 to-teal-600 text-white p-3 rounded-2xl font-bold shadow-lg w-full flex justify-center items-center gap-2 border-2 border-teal-300 active:scale-95 transition-transform text-lg"
        >
          🗺️ 地図でスポットを探す
        </button>

        <div className="flex justify-around bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
          <button onClick={() => { setViewMode('mindar'); playSound('tap'); }} className={`font-bold flex flex-col items-center gap-1 ${viewMode === 'mindar' ? 'text-blue-600' : 'text-gray-400'}`}><span className="text-xl">🏠</span><span className="text-xs">おうち</span></button>
          <button onClick={() => { setViewMode('gps'); playSound('tap'); }} className={`font-bold flex flex-col items-center gap-1 ${viewMode === 'gps' ? 'text-green-600' : 'text-gray-400'}`}><span className="text-xl">🚶</span><span className="text-xs">さんぽ</span></button>
          <button onClick={() => { setViewMode('report'); playSound('tap'); }} className={`font-bold flex flex-col items-center gap-1 ${viewMode === 'report' ? 'text-purple-600' : 'text-gray-400'}`}><span className="text-xl">📊</span><span className="text-xs">きろく</span></button>
        </div>
      </div>

      {/* --- 背面：ARレイヤー (embedded指定でコンテナに収める) --- */}
      <div className="absolute top-0 left-0 w-full h-full z-0">
        
        {viewMode === 'mindar' && sessionUserId && (
          /* @ts-ignore */
          <a-scene embedded key={`mindar-${sceneKey}-${petMarkerUrl}`} style={{ height: '100%', width: '100%' }} mindar-image={`imageTargetSrc: ${petMarkerUrl}; autoStart: true; uiLoading: no; uiError: no;`} renderer="preserveDrawingBuffer: true; colorManagement: true; physicallyCorrectLights: true;" color-space="sRGB" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
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
              <a-gltf-model
                id="pet-model"
                class={(!isEgg && !isSleeping) ? "clickable" : ""}
                rotation="0 0 0"
                position="0 0 0"
                scale={hatchAnimating ? "0.1 0.1 0.1" : "0.5 0.5 0.5"}
                src={activeModelUrl}
                shadow="cast: true; receive: true"
                // 🌟 アクションアニメーション (Idle, Eat, Jump, Sleep 等の切り替えを適用)
                animation-mixer={isEgg ? "" : `clip: ${actionAnim || currentMood.clip}; loop: ${actionAnim ? 'once' : 'repeat'}; crossFadeDuration: 0.3;`}
                animation={hatchAnimating ? `property: scale; to: 0.5 0.5 0.5; dur: 800; easing: easeOutElastic;` : undefined}
              ></a-gltf-model>
            </a-entity>
          </a-scene>
        )}

        {viewMode === 'gps' && location && (
          /* @ts-ignore */
          <a-scene embedded key={`gps-${sceneKey}-${cameraFacing}`} style={{ height: '100%', width: '100%' }} vr-mode-ui="enabled: false" renderer="preserveDrawingBuffer: true; colorManagement: true;" arjs={`sourceType: webcam; videoTexture: true; debugUIEnabled: false; facingMode: ${cameraFacing};`}>
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
                  // 🌟 お散歩モード中は Walk アニメーションを適用
                  animation-mixer="clip: Walk; loop: repeat; crossFadeDuration: 0.3;"
                ></a-entity>
              )}
            </a-camera>

            {/* スポットの実体は実際のGPS座標に配置 */}
            {activeLandmark && !isEgg && petId && (
              /* @ts-ignore */
              <a-entity gps-entity-place={`latitude: ${activeLandmark.latitude}; longitude: ${activeLandmark.longitude};`} gltf-model={activeLandmark.model_url ? "#landmark-asset-dynamic" : "/models/treasure.glb"} scale="5 5 5" position="0 2 0" animation="property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear;"></a-entity>
            )}
          </a-scene>
        )}
      </div>
    </div>
  );
}