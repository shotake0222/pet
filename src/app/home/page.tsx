'use client';

import { useState, useEffect, useMemo, Suspense, useRef, useCallback, type FormEvent } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

function HomeAR() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const rawModeParam = searchParams.get('mode');
  const modeParam = rawModeParam === 'minder' ? 'mindar' : rawModeParam;
  const tagIdParam = searchParams.get('tag_id');

  const [isClient, setIsClient] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);

  const [affection, setAffection] = useState(0);
  const [sleepingUntil, setSleepingUntil] = useState<string | null>(null);
  const [lastFedAt, setLastFedAt] = useState<string | null>(null);
  const [isEgg, setIsEgg] = useState(true);
  const [isEggUnregistered, setIsEggUnregistered] = useState(false);
  const [walkDistance, setWalkDistance] = useState(0);
  const [level, setLevel] = useState(1);
  const [exp, setExp] = useState(0);
  const [customName, setCustomName] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [generation, setGeneration] = useState(1);

  const [petCondition, setPetCondition] = useState<'healthy' | 'starving' | 'sick'>('healthy');
  const [showConditionSOS, setShowConditionSOS] = useState(false);

  const [eggModelUrl, setEggModelUrl] = useState('/models/eggs/egg_A.glb');
  const [petModelUrlV1, setPetModelUrlV1] = useState('/models/pet/N/v1.glb');
  const [petModelUrlV2, setPetModelUrlV2] = useState<string | null>(null);
  const [petModelUrlV3, setPetModelUrlV3] = useState<string | null>(null);
  const [petMasterName, setPetMasterName] = useState('名無し');
  const [petRarity, setPetRarity] = useState('?');

  const [viewMode, setViewMode] = useState<'mindar' | 'gps' | 'report'>((modeParam === 'gps' || modeParam === 'report') ? (modeParam as 'mindar' | 'gps' | 'report') : 'mindar');
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  const [mindarLoaded, setMindarLoaded] = useState(false);
  const [arjsLoaded, setArjsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const [feedCount, setFeedCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [landmarkVisitCount, setLandmarkVisitCount] = useState(0);
  const [mindfulnessLogCount, setMindfulnessLogCount] = useState(0);
  const [hallOfFameCount, setHallOfFameCount] = useState(0);

  const [hatchOverlay, setHatchOverlay] = useState<{ active: boolean; particles: any[]; rarity: string } | null>(null);

  // 🌟 4体分のマーカーを1つの.mindファイルにまとめてコンパイルしたもの（targetIndex: 0〜3）。
  // MindARは<a-scene>ごとに.mindを1つしかロードできないため、複数マーカーは
  // 1ファイルにまとめてtargetIndexで区別するのが正しい運用です。
  const petMarkerUrl = '/markers/targets.mind';

  // targetIndex(0〜3)ごとに表示する卵モデル。パスは実際のファイル名に合わせて調整してください。
  const MARKER_EGG_MODELS = [
    '/models/eggs/egg_A.glb', // targetIndex: 0
    '/models/eggs/egg_B.glb', // targetIndex: 1
    '/models/eggs/egg_C.glb', // targetIndex: 2
    '/models/eggs/egg_D.glb', // targetIndex: 3
  ];

  // 現在カメラが検出しているマーカーのtargetIndex（未検出時はnull）
  const [detectedTargetIndex, setDetectedTargetIndex] = useState<number | null>(null);

  // 🌟 サウンドファイルは毎回new Audio()せず使い回す（パフォーマンス改善 & 
  //    ファイル欠損時の挙動を安定させるため）。ここに書かれている7種類が
  //    /public/sounds/ 以下に実在している必要がある。
  const SOUND_SOURCES: Record<string, string> = {
    tap: '/sounds/tap.mp3',
    eat: '/sounds/eat.mp3',
    item: '/sounds/item.mp3',
    levelup: '/sounds/levelup.mp3',
    hatch: '/sounds/hatch.mp3',
    camera: '/sounds/camera.mp3',
    error: '/sounds/error.mp3',
  };
  const audioPoolRef = useRef<Record<string, HTMLAudioElement>>({});

  const playSound = useCallback((name: string) => {
    try {
      const src = SOUND_SOURCES[name];
      if (!src) return;

      let audio = audioPoolRef.current[name];
      if (!audio) {
        audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = 0.7;
        audioPoolRef.current[name] = audio;
      }
      // 連打しても再生できるよう毎回頭出しする
      audio.currentTime = 0;
      audio.play().catch(err => {
        // ファイル欠損(416等)やブラウザの自動再生制限で失敗しても、
        // アプリの動作自体は止めない。コンソールにだけ残す。
        console.warn(`サウンド再生に失敗しました (${name}):`, err);
      });
    } catch (err) {
      console.warn('playSound error:', err);
    }
  }, []);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (n: number) => (n * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const [hatchAnimating, setHatchAnimating] = useState(false);

  const [levelUpOverlay, setLevelUpOverlay] = useState<{ active: boolean; particles: any[]; level: number; isMilestone: boolean } | null>(null);

  const [inventory, setInventory] = useState<any[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [isShopOpen, setIsShopOpen] = useState(false);

  const [newsList, setNewsList] = useState<any[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [isNewsOpen, setIsNewsOpen] = useState(false);

  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [inputBirthYear, setInputBirthYear] = useState('');
  const [inputGender, setInputGender] = useState('');
  const [isSetupSubmitting, setIsSetupSubmitting] = useState(false);

  const [showNamingScreen, setShowNamingScreen] = useState(false);
  const [namingInput, setNamingInput] = useState('');
  const [isNamingSubmitting, setIsNamingSubmitting] = useState(false);

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

  const [showMindfulness, setShowMindfulness] = useState(false);
  const [mindPhase, setMindPhase] = useState<'intro' | 'inhale' | 'hold' | 'exhale' | 'done'>('intro');
  const [mindTime, setMindTime] = useState(5);
  const [mindSet, setMindSet] = useState(1);
  const hasTriggeredMindfulness = useRef(false);

  const [showRainbowBridge, setShowRainbowBridge] = useState(false);
  const [rainbowPhase, setRainbowPhase] = useState(0);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prevLocation, setPrevLocation] = useState<{ lat: number; lng: number } | null>(null);
  const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [activeLandmark, setActiveLandmark] = useState<any | null>(null);
  const [isSpotMapOpen, setIsSpotMapOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [sceneKey, setSceneKey] = useState(0);
  // MindAR / AR.js が生成する video・canvas・a-scene を、このUI内に閉じ込めるための親要素。
  const arViewportRef = useRef<HTMLDivElement>(null);

  // Android Chromeは読み込み中にアドレスバーの状態が確定しておらず、
  // dvh/svhの計算がジャンプすることがあるため、実測した高さをCSS変数として
  // 直接DOMへ書き込む（Reactのstateは使わず再レンダリングを起こさない）。
  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);
    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
    };
  }, []);

  // 🌟 追加したモーダル用State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);

  const lastEncounterTime = useRef(0);

  const targetDistanceToHatch = 1200;
  const targetFeedCount = 3;
  const targetLandmarkVisits = 2;
  const targetEventCount = 1;

  const stepCount = Math.floor(walkDistance / 0.75);

  // このゲームのARコンテナ内だけを解放する。ページ上の他の video / canvas には触れない。
  const releaseCameraResources = useCallback(() => {
    try {
      const viewport = arViewportRef.current;
      if (!viewport) return;

      const videos = viewport.querySelectorAll('video');
      videos.forEach(video => {
        if (video.srcObject) {
          const tracks = (video.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          video.srcObject = null;
        }
      });

      const scenes = viewport.querySelectorAll('a-scene') as NodeListOf<any>;
      scenes.forEach(scene => {
        try {
          scene.systems?.['mindar-image-system']?.stop?.();
          scene.renderer?.dispose?.();
        } catch {}
      });
    } catch {}
  }, []);

  // MindAR / AR.js が非同期で追加するDOMを、AR表示用コンテナの座標系に固定する。
  // fixed / 100vw / 100vh を使わないため、UIカードやスマホ幅の親要素からはみ出さない。
  const normalizeArLayers = useCallback(() => {
    try {
      const viewport = arViewportRef.current;
      if (!viewport) return;

      // AR.js の実装差分によっては camera video が document.body 直下へ追加される。
      // このゲームの起動中に作られたライブカメラだけを、表示用コンテナへ移動する。
      // (autoplay/playsInline属性の有無に関わらず、srcObjectが設定済みのvideoは
      //  すべて対象にすることで、Android端末での検出漏れ＝カメラが左に寄る不具合を防ぐ)
      const detachedCameraVideos = Array.from(document.querySelectorAll('video')).filter(video => {
        return !viewport.contains(video) && Boolean(video.srcObject);
      });
      detachedCameraVideos.forEach(video => viewport.prepend(video));

      const videos = viewport.querySelectorAll('video');
      videos.forEach(video => {
        const el = video as HTMLVideoElement;
        el.style.position = 'absolute';
        el.style.inset = '0';
        el.style.display = 'block';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'cover';
        el.style.zIndex = '0';
        el.style.pointerEvents = 'none';
      });

      const scenes = viewport.querySelectorAll('a-scene') as NodeListOf<any>;
      scenes.forEach(scene => {
        const el = scene as HTMLElement;
        el.style.position = 'absolute';
        el.style.inset = '0';
        el.style.display = 'block';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.zIndex = '1';
        el.style.pointerEvents = 'none';
      });

      const canvases = viewport.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        const el = canvas as HTMLCanvasElement;
        el.style.position = 'absolute';
        el.style.inset = '0';
        el.style.display = 'block';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.zIndex = '1';
        el.style.pointerEvents = 'none';
      });

      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      scenes.forEach(scene => {
        try {
          scene.resize?.();
          scene.renderer?.setSize?.(width, height, false);
          if (scene.camera) {
            scene.camera.aspect = width / height;
            scene.camera.updateProjectionMatrix?.();
          }
        } catch {}
      });
    } catch {}
  }, []);

  // 🌟 修正: フルリロードをやめて安全にモード切替
  const handleModeChange = (mode: 'mindar' | 'gps' | 'report') => {
    playSound('tap');
    if (mode === viewMode) return;

    // モード遷移時に残留しやすい前面UIを閉じる
    setIsSpotMapOpen(false);
    setIsNewsOpen(false);
    setIsInventoryOpen(false);
    setIsShopOpen(false);
    setIsStatusModalOpen(false);
    setIsDebugModalOpen(false);

    setIsSwitchingMode(true);
    setCameraReady(mode === 'report');
    // report -> mindar でも残留videoがあるため、モード遷移時は毎回解放する
    releaseCameraResources();

    setViewMode(mode);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('mode', mode);
    if (tagIdParam) {
      nextParams.set('tag_id', tagIdParam);
    }
    const query = nextParams.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', nextUrl);

    window.setTimeout(() => {
      setSceneKey(prev => prev + 1);
      setIsSwitchingMode(false);
      normalizeArLayers();
    }, 180);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  // URLの誤パラメータ (?mode=minder など) を正規化して遷移バグを防ぐ
  useEffect(() => {
    if (!rawModeParam) return;
    const isValid = rawModeParam === 'mindar' || rawModeParam === 'gps' || rawModeParam === 'report';
    if (isValid) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('mode', 'mindar');
    if (tagIdParam) {
      nextParams.set('tag_id', tagIdParam);
    }
    const query = nextParams.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [rawModeParam, searchParams, tagIdParam]);

  // --- 追加: アンマウント時のみ解放 ---
  useEffect(() => {
    return () => {
      releaseCameraResources();
    };
  }, [releaseCameraResources]);

  // モード遷移直後はARライブラリがDOMを差し替えるため、短時間だけ複数回正規化する。
  useEffect(() => {
    if (viewMode === 'report') return;
    normalizeArLayers();
    let count = 0;
    const timer = window.setInterval(() => {
      normalizeArLayers();
      count += 1;
      if (count >= 16) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [viewMode, sceneKey, isSwitchingMode, normalizeArLayers]);

  // 回転・アドレスバーの出入り・親UIのリサイズ後も、カメラとA-Frame canvasを同じ枠に合わせる。
  useEffect(() => {
    if (viewMode === 'report') return;
    const viewport = arViewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const sync = () => {
      normalizeArLayers();
      window.requestAnimationFrame(normalizeArLayers);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);

    // AR.js が video を body 直下へ追加するケースでも、追加直後にコンテナへ収める。
    const bodyObserver = new MutationObserver(sync);
    bodyObserver.observe(document.body, { childList: true });
    sync();

    return () => {
      observer.disconnect();
      bodyObserver.disconnect();
    };
  }, [viewMode, sceneKey, isSwitchingMode, normalizeArLayers]);

  useEffect(() => {
    if (isAuthChecking || !isDataLoaded) return;
    setCameraReady(viewMode === 'report');
  }, [viewMode, isAuthChecking, isDataLoaded]);

  // モード切替がまれに固まるケースへの保険
  useEffect(() => {
    if (!isSwitchingMode) return;
    const timer = window.setTimeout(() => setIsSwitchingMode(false), 1500);
    return () => window.clearTimeout(timer);
  }, [isSwitchingMode]);

  // --- 追加: videoの準備完了待ち ---
  useEffect(() => {
    if (viewMode === 'report') {
      setCameraReady(true);
      return;
    }
    if (!isClient || isAuthChecking || !isDataLoaded || isSwitchingMode) return;

    let tries = 0;
    const maxTries = 40; // 8秒
    const timer = window.setInterval(() => {
      const viewport = arViewportRef.current;
      const videos = Array.from(viewport?.querySelectorAll('video') ?? []) as HTMLVideoElement[];
      const ready = videos.some(v => v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0);

      if (ready) {
        setCameraReady(true);
        window.clearInterval(timer);
        return;
      }

      tries += 1;
      if (tries >= maxTries) {
        setCameraReady(true);
        window.clearInterval(timer);
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [viewMode, isClient, isAuthChecking, isDataLoaded, isSwitchingMode, sceneKey]);

  // ==========================================
  //  Auth & Profile チェック
  // ==========================================
  useEffect(() => {
    const initAuthAndProfile = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          const queryString = tagIdParam ? `?tag_id=${tagIdParam}` : '';
          router.push(`/login${queryString}`);
          return;
        }

        const userId = session.user.id;
        setSessionUserId(userId);

        const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();

        if (!profile || !profile.birth_year) {
          setShowProfileSetup(true);
        } else {
          setHallOfFameCount(profile.hall_of_fame_count || 0);
          await checkLoginBonus(userId, profile);
        }
      } catch (error) {
        console.error('initAuthAndProfile error', error);
      } finally {
        setIsAuthChecking(false);
      }
    };
    initAuthAndProfile();
  }, [supabase, router, tagIdParam]);

  useEffect(() => {
    if (sessionUserId && petId && !isEgg && !hasTriggeredMindfulness.current) {
      hasTriggeredMindfulness.current = true;
      if (Math.random() < 0.3) {
        setShowMindfulness(true);
        setMindPhase('intro');
      }
    }
  }, [sessionUserId, petId, isEgg]);

  useEffect(() => {
    if (!showMindfulness || mindPhase === 'intro' || mindPhase === 'done') return;
    const timer = setInterval(() => {
      setMindTime(prev => {
        if (prev > 1) return prev - 1;
        if (mindPhase === 'inhale') {
          setMindPhase('hold');
          return 2;
        }
        if (mindPhase === 'hold') {
          setMindPhase('exhale');
          return 5;
        }
        if (mindPhase === 'exhale') {
          if (mindSet < 3) {
            setMindSet(s => s + 1);
            setMindPhase('inhale');
            return 5;
          } else {
            setMindPhase('done');
            return 0;
          }
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showMindfulness, mindPhase, mindSet]);

  const startMindfulness = () => {
    setMindPhase('inhale');
    setMindTime(5);
    setMindSet(1);
  };

  const completeMindfulness = async () => {
    setShowMindfulness(false);
    alert('気分がスッキリしました！ペットのごきげんがアップしました。');
    setMotivationPercent(100);
    if (petId) {
      addExperience(20);
      await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'mindfulness', points_earned: 20 });
      setMindfulnessLogCount(prev => prev + 1);
    }
  };

  const grantLoginBonusItem = async (userId: string) => {
    let { data: item } = await supabase.from('item_masters').select('id').eq('name', 'ログボご飯').maybeSingle();

    if (!item) {
      const { data: newItem, error } = await supabase
        .from('item_masters')
        .insert({
          name: 'ログボご飯',
          description: '7日間ログインしたご褒美！普通のご飯より少し多くやる気が回復する特別なおご飯。',
          item_type: 'food',
          price_jpy: 0,
          effect_value: 15,
          image_url: null,
        })
        .select('id')
        .single();

      if (error) return;
      item = newItem;
    }

    const { data: inventoryItem } = await supabase.from('user_inventory').select('id, quantity').eq('user_id', userId).eq('item_id', item.id).maybeSingle();

    if (inventoryItem) {
      await supabase
        .from('user_inventory')
        .update({ quantity: inventoryItem.quantity + 1 })
        .eq('id', inventoryItem.id);
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
      currentLoginDays = currentLoginDays >= 7 ? 1 : currentLoginDays + 1;

      let gotBonus = false;
      if (currentLoginDays === 7) {
        await grantLoginBonusItem(userId);
        gotBonus = true;
      }

      await supabase
        .from('user_profiles')
        .update({
          last_login_date: today,
          login_days: currentLoginDays,
        })
        .eq('id', userId);

      setLoginBonusState({
        days: currentLoginDays,
        gotBonus: gotBonus,
        showModal: true,
      });
      playSound('levelup');
    }
  };

  useEffect(() => {
    const fetchGameData = async () => {
      if (!sessionUserId) return;

      try {
        const { data: items } = await supabase.from('item_masters').select('*').order('id', { ascending: false });
        if (items) setShopItems(items);

        const { data: spots } = await supabase.from('landmarks').select('*, landmark_masters(facility_type)');
        if (spots) setLandmarks(spots);

        const { data: news } = await supabase.from('announcements').select('*').eq('is_active', true).order('published_at', { ascending: false });
        if (news) setNewsList(news);

        const { data: notifications } = await supabase.from('user_notifications').select('*').eq('user_id', sessionUserId).order('created_at', { ascending: false }).limit(20);
        if (notifications) setUserNotifications(notifications);

        setGameOverNotice(null);
        setGameOverHandled(false);

        const { data: pet } = await supabase
          .from('pets')
          .select(`
          id, owner_id, affection_level, sleeping_until, last_fed_at, 
          is_egg, walk_distance_m, level, exp, custom_name, birthday, condition_status, generation, is_deceased, egg_master_id, pet_master_id,
          pet_masters(name, model_url, model_url_v2, model_url_v3, rarity, egg_type)
        `)
          .eq('owner_id', sessionUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pet && !pet.is_deceased) {
          setPetId(pet.id);
          setOwnerId(pet.owner_id);
          setAffection(pet.affection_level || 0);
          setSleepingUntil(pet.sleeping_until);
          setLastFedAt(pet.last_fed_at);
          setIsEgg(pet.is_egg);
          setWalkDistance(pet.walk_distance_m || 0);
          setLevel(pet.level || 1);
          setExp(pet.exp || 0);
          setCustomName(pet.custom_name);
          setBirthday(pet.birthday);
          setGeneration(pet.generation || 1);
          setIsEggUnregistered(false);

          const currentCondition = pet.condition_status || 'healthy';
          setPetCondition(currentCondition as any);
          if (currentCondition !== 'healthy') {
            setShowConditionSOS(true);
          } else {
            setShowConditionSOS(false);
          }

          if (pet.egg_master_id) {
            const { data: eggData } = await supabase.from('egg_masters').select('*').eq('id', pet.egg_master_id).maybeSingle();
            if (eggData && eggData.model_url) {
              setEggModelUrl(eggData.model_url);
            } else {
              setEggModelUrl('/models/eggs/egg_A.glb');
            }
          } else {
            setEggModelUrl('/models/eggs/egg_A.glb');
          }

          if (pet.pet_masters) {
            const pm = (pet.pet_masters && pet.pet_masters[0] ? pet.pet_masters[0] : pet.pet_masters) || {};
            const rarityPm = (pm as any).rarity || '?';
            const fallbackBase = `/models/pet/${rarityPm}`;

            setPetModelUrlV1((pm as any).model_url || `${fallbackBase}/v1.glb`);
            setPetModelUrlV2((pm as any).model_url_v2 || `${fallbackBase}/v2.glb`);
            setPetModelUrlV3((pm as any).model_url_v3 || `${fallbackBase}/v3.glb`);
            setPetMasterName((pm as any).name || '不明');
            setPetRarity(rarityPm);
          }

          const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', sessionUserId).gt('quantity', 0);
          if (inv) setInventory(inv);

          const { count: feedLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'feed');
          if (feedLogCount !== null) setFeedCount(feedLogCount);

          const { count: eventLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'event');
          if (eventLogCount !== null) setEventCount(eventLogCount);

          const { count: mindCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'mindfulness');
          if (mindCount !== null) setMindfulnessLogCount(mindCount);

          const { count: landmarkCount } = await supabase.from('landmark_visits').select('id', { count: 'exact', head: true }).eq('user_id', sessionUserId);
          if (landmarkCount !== null) setLandmarkVisitCount(landmarkCount);

          if (!pet.is_egg && pet.birthday) {
            const daysLived = (new Date().getTime() - new Date(pet.birthday).getTime()) / (1000 * 3600 * 24);
            if (daysLived > 30) {
              triggerRainbowBridge(pet.id, pet.generation || 1);
            }
          }
        } else {
          setIsEggUnregistered(true);
          setIsEgg(true);
          setEggModelUrl('/models/eggs/egg_A.glb');
        }
      } catch (error) {
        console.error('fetchGameData error', error);
      } finally {
        // データ取得失敗時でもロード画面で固まらないようにする
        setIsDataLoaded(true);
      }
    };
    fetchGameData();
  }, [sessionUserId, supabase]);

  const triggerRainbowBridge = async (targetPetId: string, currentGeneration: number) => {
    setShowRainbowBridge(true);
    setRainbowPhase(1);

    try {
      const newHallOfFameCount = hallOfFameCount + 1;
      await supabase.from('user_profiles').update({ hall_of_fame_count: newHallOfFameCount }).eq('id', sessionUserId);
      setHallOfFameCount(newHallOfFameCount);

      await supabase
        .from('pets')
        .update({
          is_egg: true,
          walk_distance_m: 0,
          level: 1,
          exp: 300,
          affection_level: 50,
          sleeping_until: null,
          last_fed_at: null,
          custom_name: null,
          birthday: null,
          condition_status: 'healthy',
          generation: currentGeneration + 1,
        })
        .eq('id', targetPetId);

      setTimeout(() => {
        setRainbowPhase(2);
      }, 4000);
    } catch (error) {
      console.error('虹の橋の処理に失敗しました', error);
    }
  };

  const closeRainbowBridge = () => {
    setShowRainbowBridge(false);
    window.location.reload();
  };

  const getCurrentModelUrl = () => {
    if (isEgg || isEggUnregistered) {
      // マーカーを検出中はそのマーカーに対応する卵モデルを優先表示する
      if (detectedTargetIndex !== null && MARKER_EGG_MODELS[detectedTargetIndex]) {
        return MARKER_EGG_MODELS[detectedTargetIndex];
      }
      return eggModelUrl;
    }
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
      await supabase
        .from('pets')
        .update({
          is_egg: true,
          walk_distance_m: 0,
          level: 1,
          exp: 0,
          affection_level: 0,
          sleeping_until: null,
          last_fed_at: null,
          custom_name: null,
          birthday: null,
          condition_status: 'healthy',
        })
        .eq('id', petId);

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
      setPetCondition('healthy');
      setShowConditionSOS(false);
      setGameOverNotice(`💀 ${reason}\n卵に戻ってしまった…もう一度育て直そう！`);
      playSound('error');
    } catch (error) {
      console.error('ゲームオーバー処理に失敗しました', error);
    }
  };

  useEffect(() => {
    if (!lastFedAt || isEgg) return;
    const calculateStatus = async () => {
      const now = new Date().getTime();
      const lastFedTime = new Date(lastFedAt).getTime();
      const hoursPassed = (now - lastFedTime) / (1000 * 60 * 60);
      let calculatedHunger = 100 - (hoursPassed / 24) * 100;
      if (isSleeping) calculatedHunger = Math.max(calculatedHunger, 50);
      const finalHunger = Math.max(0, Math.min(100, Math.floor(calculatedHunger)));
      setHungerPercent(finalHunger);

      let baseMotivation = 50 + affection * 2;
      if (finalHunger < 50 && !isSleeping) baseMotivation -= (50 - finalHunger) * 2;
      if (isSleeping) baseMotivation = 100;
      setMotivationPercent(Math.max(0, Math.min(100, Math.floor(baseMotivation))));

      if (finalHunger <= 20 && petCondition !== 'starving') {
        setPetCondition('starving');
        setShowConditionSOS(true);
        playSound('error');
        if (petId) await supabase.from('pets').update({ condition_status: 'starving' }).eq('id', petId);
      } else if (finalHunger > 20 && petCondition === 'starving') {
        setPetCondition('healthy');
        setShowConditionSOS(false);
        if (petId) await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      }
    };
    calculateStatus();
    const interval = setInterval(calculateStatus, 60000);
    return () => clearInterval(interval);
  }, [lastFedAt, affection, isEgg, isSleeping, petCondition, petId, supabase]);

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
    if (petCondition === 'starving') return { text: '😵 空腹で動けない', color: 'bg-red-800', clip: 'Sad' };
    if (petCondition === 'sick') return { text: '🤒 具合がわるい', color: 'bg-purple-600', clip: 'Sad' };
    if (hungerPercent <= 30) return { text: '💢 はらぺこ', color: 'bg-red-600', clip: 'Angry' };
    if (motivationPercent <= 30) return { text: '💧 しょんぼり', color: 'bg-blue-400', clip: 'Sad' };
    if (motivationPercent >= 80) return { text: '✨ 絶好調！', color: 'bg-pink-500', clip: 'Happy' };
    return { text: '😐 おだやか', color: 'bg-green-500', clip: 'Idle' };
  };
  const currentMood = getCurrentMood();

  const showHatchEffect = (rarity: string) => {
    return new Promise<void>(resolve => {
      const multiplier = rarity === 'UR' ? 3 : rarity === 'SR' ? 2 : rarity === 'R' ? 1.5 : 1;
      const base = 12;
      const count = Math.min(120, Math.floor(base * multiplier * (rarity === 'UR' ? 2.5 : 1)));
      const colors = {
        N: ['#E5E7EB', '#F9FAFB'],
        R: ['#FDE68A', '#FCA5A5', '#FBCFE8'],
        SR: ['#C7A3FF', '#FDE68A', '#FECACA', '#A7F3D0'],
        UR: ['#FFD700', '#FF73FA', '#7CF0FF', '#FF9F1C'],
      } as Record<string, string[]>;

      const particles = Array.from({ length: count }).map((_, i) => {
        const angle = (Math.random() - 0.5) * Math.PI * 2;
        const distance = 80 + Math.random() * (rarity === 'UR' ? 360 : rarity === 'SR' ? 260 : rarity === 'R' ? 180 : 120);
        return {
          id: `${Date.now()}_${i}`,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - Math.random() * 80,
          color: (colors[rarity as keyof typeof colors] || colors.N)[Math.floor(Math.random() * (colors[rarity as keyof typeof colors] || colors.N).length)],
          size: 6 + Math.random() * (rarity === 'UR' ? 12 : rarity === 'SR' ? 10 : 6),
          duration: 700 + Math.random() * (rarity === 'UR' ? 1200 : 800),
        };
      });

      setHatchOverlay({ active: true, particles, rarity });
      setTimeout(() => {
        setHatchOverlay(prev => (prev ? { ...prev, particles: prev.particles.map(p => ({ ...p, launched: true })) } : prev));
      }, 1000);

      const maxDuration = Math.max(...particles.map(p => p.duration)) + 300;
      setTimeout(() => {
        setHatchOverlay(null);
        resolve();
      }, maxDuration);
    });
  };

  const showLevelUpEffect = (newLevel: number) => {
    return new Promise<void>(resolve => {
      const isMilestone = newLevel % 5 === 0;
      const count = isMilestone ? 150 : 50;

      const colors = isMilestone ? ['#FFD700', '#FF73FA', '#7CF0FF', '#FF9F1C', '#FFFFFF'] : ['#60A5FA', '#34D399', '#FBBF24'];

      const particles = Array.from({ length: count }).map((_, i) => {
        const angle = (Math.random() - 0.5) * Math.PI * 2;
        const distance = isMilestone ? 150 + Math.random() * 250 : 80 + Math.random() * 150;
        return {
          id: `lvl_${Date.now()}_${i}`,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: isMilestone ? 8 + Math.random() * 12 : 6 + Math.random() * 8,
          duration: isMilestone ? 1000 + Math.random() * 1500 : 700 + Math.random() * 800,
        };
      });

      setLevelUpOverlay({ active: true, particles, level: newLevel, isMilestone });

      setTimeout(() => {
        setLevelUpOverlay(prev => (prev ? { ...prev, particles: prev.particles.map(p => ({ ...p, launched: true })) } : prev));
      }, 40);

      const maxDuration = Math.max(...particles.map(p => p.duration)) + 300;
      setTimeout(() => {
        setLevelUpOverlay(null);
        resolve();
      }, maxDuration);
    });
  };

  const triggerRandomSickness = async () => {
    if (level > 2 && Math.random() < 0.15 && petCondition === 'healthy') {
      setPetCondition('sick');
      setShowConditionSOS(true);
      playSound('error');
      if (petId) {
        await supabase.from('pets').update({ condition_status: 'sick' }).eq('id', petId);
      }
    }
  };

  const addExperience = async (amount: number) => {
    if (!petId) return;
    let newExp = exp + amount;
    let newLevel = level;
    let leveledUp = false;
    const expNeeded = newLevel * 150;
    const nextRequirements = getLevelRequirement(newLevel);
    if (newExp >= expNeeded) {
      if (walkDistance >= nextRequirements.distance && feedCount >= nextRequirements.feed && landmarkVisitCount >= nextRequirements.landmark && eventCount >= nextRequirements.event) {
        newExp -= expNeeded;
        newLevel += 1;
        leveledUp = true;
      } else {
        setExp(newExp);
        await supabase.from('pets').update({ exp: newExp }).eq('id', petId);
        return alert(`🌱 もうすぐレベルアップ！ でもまだ条件が揃っていません。
必要: 歩行 ${nextRequirements.distance}m / 給餌 ${nextRequirements.feed}回 / ランドマーク ${nextRequirements.landmark}回 / イベント ${nextRequirements.event}回`);
      }
    }
    setExp(newExp);
    setLevel(newLevel);
    await supabase.from('pets').update({ exp: newExp, level: newLevel }).eq('id', petId);

    if (leveledUp) {
      playSound('levelup');
      await showLevelUpEffect(newLevel);

      alert(`🌟 レベルアップ！ Lv.${newLevel} になりました！`);
      if (newLevel === 5 && petModelUrlV2) alert('体が大きくなったみたい…！');
      if (newLevel === 10 && petModelUrlV3) alert('姿が大きく変わった…！');

      await triggerRandomSickness();
    }
  };

  const triggerEncounter = async () => {
    if (!sessionUserId) return;
    const now = Date.now();
    if (now - lastEncounterTime.current < 300000) return;
    lastEncounterTime.current = now;

    try {
      let { data: item } = await supabase.from('item_masters').select('id').eq('name', 'ぺたるの香り').maybeSingle();
      if (item) {
        const { data: inventoryItem } = await supabase.from('user_inventory').select('id, quantity').eq('user_id', sessionUserId).eq('item_id', item.id).maybeSingle();

        if (inventoryItem) {
          await supabase
            .from('user_inventory')
            .update({ quantity: inventoryItem.quantity + 1 })
            .eq('id', inventoryItem.id);
        } else {
          await supabase.from('user_inventory').insert({ user_id: sessionUserId, item_id: item.id, quantity: 1 });
        }
      }

      const newNotification = {
        user_id: sessionUserId,
        title: 'すれ違い通信',
        content: 'ほかのユーザーとすれ違いました！「ぺたるの香り」を手に入れました。もちものから使用して経験値を獲得しましょう！',
      };
      await supabase.from('user_notifications').insert(newNotification);

      setUserNotifications(prev => [newNotification, ...prev]);
      alert('📡 すれ違い通信が発生しました！お知らせを確認してください。');
      playSound('item');
    } catch (err) {
      console.error('すれ違い処理エラー', err);
    }
  };

  useEffect(() => {
    if (viewMode !== 'gps' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async position => {
        const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
        const lastLoc = prevLocationRef.current;

        setLocation(newLoc);
        setPrevLocation(newLoc);

        if (lastLoc) {
          const dist = getDistance(lastLoc.lat, lastLoc.lng, newLoc.lat, newLoc.lng);
          if (dist > 2 && dist < 50) {
            setWalkDistance(prev => {
              const newDistance = prev + dist;
              if (petId) {
                void supabase.from('pets').update({ walk_distance_m: newDistance }).eq('id', petId);
              }
              return newDistance;
            });

            if (Math.random() < 0.1) {
              void triggerEncounter();
            }
          }
        }

        prevLocationRef.current = newLoc;
      },
      error => console.error('GPSエラー', error),
      { enableHighAccuracy: true, maximumAge: 0 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [viewMode, petId, supabase]);

  useEffect(() => {
    if (viewMode === 'gps' && location && landmarks.length > 0) {
      setActiveLandmark(landmarks.find(lm => getDistance(location.lat, location.lng, lm.latitude, lm.longitude) <= lm.radius_meters) || null);
    }
  }, [location, landmarks, viewMode]);

  // GPS以外へ遷移したら地図モーダルを必ず閉じる
  useEffect(() => {
    if (viewMode !== 'gps') {
      setIsSpotMapOpen(false);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'mindar' && petId && !isEgg && !isSleeping && isDataLoaded) {
      const handlePetTap = () => {
        if (petCondition === 'starving' || petCondition === 'sick') {
          playSound('error');
          setActionAnim('Sad');
          setTimeout(() => setActionAnim(null), 1500);
          setShowConditionSOS(true);
          return;
        }

        playSound('tap');
        setAffection(prev => {
          const val = prev + 1;
          supabase.from('pets').update({ affection_level: val }).eq('id', petId).then();
          return val;
        });
        setEventCount(prev => prev + 1);
        supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'event', points_earned: 5 }).then();

        const tapActions = ['Jump', 'Fly', 'Happy'];
        const randomAction = tapActions[Math.floor(Math.random() * tapActions.length)];
        setActionAnim(randomAction);
        setTimeout(() => setActionAnim(null), 1500);

        addExperience(5);
      };
      // マーカーが4つに増えたため、どのマーカー上のペットモデルがタップされても反応するようにする
      const petModels = MARKER_EGG_MODELS.map((_, i) => document.querySelector(`#pet-model-${i}`)).filter(Boolean) as Element[];
      petModels.forEach(el => el.addEventListener('click', handlePetTap));
      return () => petModels.forEach(el => el.removeEventListener('click', handlePetTap));
    }
  }, [viewMode, isClient, petId, supabase, isEgg, isSleeping, sceneKey, petCondition, isDataLoaded]);

  // 4つのマーカーのうち、現在どれが検出されているかをtargetFound/targetLostイベントで追跡する
  useEffect(() => {
    if (viewMode !== 'mindar' || !(aframeLoaded && extrasLoaded && mindarLoaded) || isSwitchingMode) return;

    const cleanups: Array<() => void> = [];
    MARKER_EGG_MODELS.forEach((_, i) => {
      const el = document.querySelector(`#marker-target-${i}`);
      if (!el) return;
      const onFound = () => setDetectedTargetIndex(i);
      const onLost = () => setDetectedTargetIndex(prev => (prev === i ? null : prev));
      el.addEventListener('targetFound', onFound);
      el.addEventListener('targetLost', onLost);
      cleanups.push(() => {
        el.removeEventListener('targetFound', onFound);
        el.removeEventListener('targetLost', onLost);
      });
    });

    return () => cleanups.forEach(fn => fn());
  }, [viewMode, aframeLoaded, extrasLoaded, mindarLoaded, isSwitchingMode, sceneKey]);

  const handleCreateEgg = async () => {
    if (!sessionUserId) return;
    try {
      const { data: eggMasters, error: fetchError } = await supabase.from('egg_masters').select('*');
      if (fetchError || !eggMasters || eggMasters.length === 0) {
        throw new Error('卵のマスターデータが見つかりません。データベースに卵を登録してください。');
      }

      const selectedEgg = eggMasters[Math.floor(Math.random() * eggMasters.length)];

      const { data: newPet, error: insertError } = await supabase
        .from('pets')
        .insert({
          owner_id: sessionUserId,
          egg_master_id: selectedEgg.id,
          pet_master_id: null,
          is_egg: true,
          level: 1,
          exp: 0,
          affection_level: 0,
          walk_distance_m: 0,
          condition_status: 'healthy',
          generation: 1,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      setPetId(newPet.id);
      setOwnerId(newPet.owner_id);
      setIsEgg(true);
      setIsEggUnregistered(false);
      setWalkDistance(0);
      setFeedCount(0);
      setLandmarkVisitCount(0);
      setEventCount(0);
      setGameOverNotice(null);
      setGameOverHandled(false);
      setLastFedAt(null);
      setSleepingUntil(null);
      setHungerPercent(100);
      setMotivationPercent(100);
      setLevel(1);
      setExp(0);
      setAffection(0);

      setEggModelUrl(selectedEgg.model_url || '/models/eggs/egg_A.glb');

      playSound('item');
      alert(`不思議な卵を発見した！\nさんぽ、給餌、ランドマーク、イベントの全てをこなして孵化させよう！`);
      setNamingInput('');
      setShowNamingScreen(true);
    } catch (err: any) {
      console.error(err);
      alert(`エラーが発生しました: ${err.message}`);
    }
  };

  const handleHatchEgg = async (force = false) => {
    if (!petId) return;
    if (!isHatchReady && !force) {
      return alert('まだ孵化条件が揃っていません。歩数・給餌・ランドマーク・イベントを全て満たしてから試してください。');
    }

    try {
      const { data: petMasters } = await supabase.from('pet_masters').select('*');
      if (!petMasters || petMasters.length === 0) {
        return alert('ペットのマスターデータが見つかりません。管理画面からペットを登録してください。');
      }
      const selectedMaster = petMasters[Math.floor(Math.random() * petMasters.length)];

      const rarityRes = selectedMaster.rarity || '?';
      const fallbackBase = `/models/pet/${rarityRes}`;
      const modelV1 = selectedMaster.model_url || `${fallbackBase}/v1.glb`;
      const modelV2 = selectedMaster.model_url_v2 || `${fallbackBase}/v2.glb`;
      const modelV3 = selectedMaster.model_url_v3 || `${fallbackBase}/v3.glb`;

      setPetRarity(rarityRes);
      setPetMasterName(selectedMaster.name || '不明');
      setPetModelUrlV1(modelV1);
      setPetModelUrlV2(modelV2);
      setPetModelUrlV3(modelV3);

      playSound('hatch');
      await showHatchEffect(rarityRes);

      setIsEgg(false);
      setSceneKey(prev => prev + 1);
      setHatchAnimating(true);
      if (rarityRes === 'SR' || rarityRes === 'UR') playSound('levelup');

      setTimeout(async () => {
        const today = new Date().toISOString().split('T')[0];
        setBirthday(today);
        setLastFedAt(new Date().toISOString());

        await supabase
          .from('pets')
          .update({
            is_egg: false,
            pet_master_id: selectedMaster.id,
            last_fed_at: new Date().toISOString(),
            birthday: today,
          })
          .eq('id', petId);

        setHatchAnimating(false);
        if (!customName) {
          setNamingInput('');
          setShowNamingScreen(true);
        }
      }, 900);
    } catch (e) {
      console.error('孵化エラー:', e);
    }
  };

  const handleFeed = async () => {
    if (!petId || isSleeping || petCondition === 'sick') return;
    playSound('eat');
    setActionAnim('Eat');
    setTimeout(() => setActionAnim(null), 2000);
    setFeedCount(prev => prev + 1);
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'feed', points_earned: 10 });
    if (!isEgg) {
      const now = new Date().toISOString();
      setLastFedAt(now);
      setHungerPercent(100);
      await supabase.from('pets').update({ last_fed_at: now }).eq('id', petId);
      if (petCondition === 'starving') {
        setPetCondition('healthy');
        setShowConditionSOS(false);
        await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      }
    }
    addExperience(20);
  };

  const handleUseItem = async (invItem: any) => {
    if (!petId) return;
    if (isSleeping) {
      playSound('error');
      alert('ペットは眠っています。起きてからアイテムを使ってね。');
      return;
    }

    const item = invItem.item_masters;
    if (!item) return;

    // 効果がない状況では消費しない。
    if (item.item_type === 'food' && petCondition === 'sick') {
      playSound('error');
      alert('体調が悪くてご飯が食べられないみたい…病院に行こう！');
      return;
    }
    if (item.item_type === 'medicine' && petCondition !== 'sick') {
      playSound('error');
      alert('今は健康なので、お薬は使わずに取っておこう。');
      return;
    }

    try {
      const nextQuantity = invItem.quantity - 1;
      const { error } = await supabase
        .from('user_inventory')
        .update({ quantity: nextQuantity })
        .eq('id', invItem.id);
      if (error) throw error;

      setInventory(prev => prev
        .map(i => (i.id === invItem.id ? { ...i, quantity: nextQuantity } : i))
        .filter(i => i.quantity > 0));
      setIsInventoryOpen(false);
      playSound('item');
    } catch (error) {
      console.error('アイテム使用エラー:', error);
      alert('アイテムを使えませんでした。通信状態を確認して、もう一度お試しください。');
      return;
    }

    if (item.item_type === 'food') {
      const newAffection = affection + item.effect_value;
      const now = new Date().toISOString();
      setAffection(newAffection);
      setLastFedAt(now);
      setHungerPercent(100);
      setFeedCount(prev => prev + 1);
      await supabase.from('pets').update({ affection_level: newAffection, last_fed_at: now }).eq('id', petId);
      await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'feed', points_earned: item.effect_value || 20 });
      setActionAnim('Eat');
      setTimeout(() => setActionAnim(null), 2000);
      addExperience(50);
      alert(`✨ ${item.name} をあげました！`);
      if (petCondition === 'starving') {
        setPetCondition('healthy');
        setShowConditionSOS(false);
        await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      }
    } else if (item.item_type === 'sleep') {
      const sleepEnd = new Date();
      sleepEnd.setHours(sleepEnd.getHours() + item.effect_value);
      setSleepingUntil(sleepEnd.toISOString());
      await supabase.from('pets').update({ sleeping_until: sleepEnd.toISOString() }).eq('id', petId);
      alert(`💤 ペットは ${item.effect_value} 時間眠りにつきました。`);
    } else if (item.item_type === 'medicine') {
      setPetCondition('healthy');
      setShowConditionSOS(false);
      await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      setActionAnim('Happy');
      setTimeout(() => setActionAnim(null), 2000);
      alert('✨ お薬が効いて元気になりました！');
    } else if (item.item_type === 'exp') {
      addExperience(item.effect_value || 100);
      alert(`✨ ${item.name} の香りに包まれて、経験値を獲得しました！`);
    } else {
      // 将来追加する種類のアイテムも、少なくとも経験値アイテムとして利用可能にする。
      addExperience(item.effect_value || 10);
      alert(`✨ ${item.name} を使いました！`);
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
        await supabase
          .from('user_inventory')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);
      } else {
        await supabase.from('user_inventory').insert({ user_id: sessionUserId, item_id: shopItem.id, quantity: 1 });
      }
      const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters(*)').eq('user_id', sessionUserId).gt('quantity', 0);
      if (inv) setInventory(inv);
      alert('🛍️ 購入しました！「もちもの」から使用できます。');
    } catch (e) {
      alert('エラーが発生しました');
    }
  };

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

    if (petCondition === 'starving' && facilityType !== 'restaurant') {
      return alert('お腹が減りすぎて動けません…まずはマップから【ご飯屋さん】を探してチェックインしましょう！');
    }
    if (petCondition === 'sick' && facilityType !== 'hospital') {
      return alert('体調が優れないようです…まずはマップから【ドクター (病院)】を探して診てもらいましょう！');
    }

    const { error: visitError } = await supabase.from('landmark_visits').insert({ user_id: sessionUserId, landmark_id: activeLandmark.id, visited_date: today });
    if (visitError) return alert('今日は既に訪問済みです！');

    setLandmarkVisitCount(prev => prev + 1);
    playSound('levelup');
    await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'landmark_visit', points_earned: activeLandmark.bonus_points });

    if (facilityType === 'restaurant') {
      alert(`🍽️ ${activeLandmark.name} に到着！\n美味しい匂いに釣られて元気が出た！`);
      if (petCondition === 'starving') {
        setPetCondition('healthy');
        setShowConditionSOS(false);
        await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      }
      const now = new Date().toISOString();
      setLastFedAt(now);
      setHungerPercent(100);
      await supabase.from('pets').update({ last_fed_at: now }).eq('id', petId);
    } else if (facilityType === 'hospital') {
      alert(`🏥 ${activeLandmark.name} で診察を受けました！\n体調が全回復しました！`);
      if (petCondition === 'sick') {
        setPetCondition('healthy');
        setShowConditionSOS(false);
        await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      }
      setMotivationPercent(100);
    } else if (facilityType === 'hotel') {
      alert(`🏨 ${activeLandmark.name} でぐっすり休憩！\nごきげんがMAXになりました！`);
      setMotivationPercent(100);
    } else {
      alert(`🎉 ${activeLandmark.name} で ${activeLandmark.bonus_points} ポイント獲得！\n経験値が大幅にアップ！`);
    }

    addExperience(100);
  };

  const takeSnapshot = () => {
    playSound('camera');

    const viewport = arViewportRef.current;
    if (!viewport) {
      return alert('AR表示領域が見つかりません。少し待ってから再度お試しください。');
    }

    const video = viewport.querySelector('video');
    const aScene = viewport.querySelector('a-scene') as any;
    const aframeCanvas = viewport.querySelector('canvas.a-canvas') || aScene?.canvas || viewport.querySelector('canvas');

    if (!video && !aframeCanvas) {
      return alert('カメラ映像とAR画面の両方が見つかりません。少し待ってから再度お試しください。');
    }

    try {
      const rect = viewport.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) return alert('画像処理エンジンの起動に失敗しました。');

      if (video && (video as HTMLVideoElement).readyState >= 2) {
        const v = video as HTMLVideoElement;
        const videoRatio = v.videoWidth / v.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        let drawWidth, drawHeight, startX, startY;

        if (videoRatio > canvasRatio) {
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoRatio;
          startX = (canvas.width - drawWidth) / 2;
          startY = 0;
        } else {
          drawWidth = canvas.width;
          drawHeight = canvas.width / videoRatio;
          startX = 0;
          startY = (canvas.height - drawHeight) / 2;
        }
        ctx.drawImage(v, startX, startY, drawWidth, drawHeight);
      }

      if (aframeCanvas) {
        ctx.drawImage(aframeCanvas as HTMLCanvasElement, 0, 0, canvas.width, canvas.height);
      }

      const link = document.createElement('a');
      link.download = `straid-ar-snap-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e: any) {
      console.error('Snapshot Error:', e);
      alert('写真の生成中にセキュリティエラー等が発生しました。\n詳細: ' + (e?.message || '不明なエラー'));
    }
  };

  const handleProfileSubmit = async (e: FormEvent) => {
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
      const { error } = await supabase.from('user_profiles').upsert(
        {
          id: sessionUserId,
          birth_year: birthYear,
          gender: inputGender,
          email_notify_feed: true,
          email_notify_news: true,
          last_login_date: today,
          login_days: 1,
        },
        { onConflict: 'id' },
      );

      if (error) {
        throw error;
      }

      setShowProfileSetup(false);
      alert('プロフィールを設定しました！');

      setLoginBonusState({
        days: 1,
        gotBonus: false,
        showModal: true,
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

  const handleNamingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!petId || !namingInput.trim()) return;

    setIsNamingSubmitting(true);
    try {
      await supabase.from('pets').update({ custom_name: namingInput.trim() }).eq('id', petId);
      setCustomName(namingInput.trim());
      setShowNamingScreen(false);
      playSound('levelup');
      if (isEgg) {
        alert(`「${namingInput.trim()}」と名付けました！\n大切に育ててあげよう！`);
      } else {
        alert(`これからよろしくね、${namingInput.trim()}！\n（誕生日は今日の日付で記録されました）`);
      }
    } catch (err) {
      console.error('名付けエラー', err);
      alert('エラーが発生しました。');
    } finally {
      setIsNamingSubmitting(false);
    }
  };

  // 🌟 デバッグ用アクション 🌟
  const debugMaxHatchConditions = async () => {
    if (!petId) return;
    setWalkDistance(targetDistanceToHatch);
    setFeedCount(targetFeedCount);
    setLandmarkVisitCount(targetLandmarkVisits);
    setEventCount(targetEventCount);
    await supabase.from('pets').update({ walk_distance_m: targetDistanceToHatch }).eq('id', petId);
    alert('孵化条件をMAXにしました');
  };

  const scriptsReadyForMindar = aframeLoaded && extrasLoaded && mindarLoaded;
  const scriptsReadyForGps = aframeLoaded && arjsLoaded;

  // 🌟 ここで未ログインやロード中ならUI・AR描画を完全にブロック
  if (!isClient || isAuthChecking || (sessionUserId && !isDataLoaded)) {
    return (
      <div className='bg-black w-full h-full flex flex-col items-center justify-center text-white absolute inset-0 z-[9999]'>
        <div className='w-10 h-10 border-4 border-gray-500 border-t-white rounded-full animate-spin mb-4'></div>
        <p className='font-bold'>データ読み込み中...</p>
      </div>
    );
  }

  return (
    <div className='relative isolate w-full h-full min-h-0 min-w-0 max-w-full overflow-hidden bg-black text-white'>
      {/* 🌟 画面が左側に潰れる問題(親コンテナ幅依存の暴走)を根本から防ぐ強制CSS */}
      <style jsx global>{`
        html,
        body {
          background-color: transparent !important;
          width: 100vw !important;
          max-width: 100vw !important;
          min-width: 0 !important;
          height: 100vh !important;
          height: 100svh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          overscroll-behavior: none;
        }
        /* Pages Router 用（App Routerでは無視される） */
        #__next {
          background-color: transparent !important;
          width: 100%;
          max-width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .ar-camera-viewport {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          max-width: 100%;
          overflow: hidden;
          isolation: isolate;
          contain: layout paint;
          background: #000;
        }
        .ar-camera-viewport a-scene,
        .ar-camera-viewport .a-canvas,
        .ar-camera-viewport video {
          position: absolute !important;
          inset: 0 !important;
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          min-width: 0 !important;
          min-height: 0 !important;
          pointer-events: none !important;
        }
        .ar-camera-viewport a-scene,
        .ar-camera-viewport .a-canvas {
          z-index: 1 !important;
          background: transparent !important;
        }
        .ar-camera-viewport video {
          z-index: 0 !important;
          object-fit: cover !important;
        }
        .ar-camera-viewport .a-enter-vr,
        .ar-camera-viewport .mindar-ui-overlay,
        .ar-camera-viewport .arjs-loader {
          display: none !important;
        }
      `}</style>

      <Script src='https://aframe.io/releases/1.5.0/aframe.min.js' strategy='afterInteractive' onLoad={() => setAframeLoaded(true)} />
      <Script src='https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.2.0/dist/aframe-extras.min.js' strategy='afterInteractive' onLoad={() => setExtrasLoaded(true)} />
      <Script src='https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js' strategy='afterInteractive' onLoad={() => setMindarLoaded(true)} />
      <Script src='https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js' strategy='afterInteractive' onLoad={() => setArjsLoaded(true)} />

      {!cameraReady && viewMode !== 'report' && (
        <div className='absolute inset-0 z-[170] bg-black/70 backdrop-blur-sm flex items-center justify-center'>
          <div className='text-center'>
            <div className='w-10 h-10 border-4 border-gray-500 border-t-white rounded-full animate-spin mx-auto mb-3'></div>
            <p className='font-bold'>カメラを起動しています...</p>
          </div>
        </div>
      )}

      {viewMode === 'gps' && !location && !isSwitchingMode && (
        <div className='absolute top-20 left-1/2 -translate-x-1/2 z-[180] bg-black/60 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm'>
          GPSを取得中です... そのまま少しお待ちください
        </div>
      )}

      {/* --- 左下デバッグボタン --- */}
      <button
        onClick={() => setIsDebugModalOpen(true)}
        className='absolute bottom-24 left-4 z-[260] bg-black/50 text-white p-3 rounded-full shadow-2xl active:scale-95 text-xl backdrop-blur-sm border border-gray-600'
        aria-label='デバッグメニュー'
      >
        🐞
      </button>

      {/* --- デバッグモーダル --- */}
      {isDebugModalOpen && (
        <div className='absolute inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto relative'>
            <div className='flex justify-between items-center mb-2 border-b pb-2'>
              <h2 className='text-xl font-bold text-red-600'>🐞 デバッグメニュー</h2>
              <button onClick={() => setIsDebugModalOpen(false)} className='text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded'>
                閉じる
              </button>
            </div>

            <div className='space-y-2'>
              <h3 className='font-bold text-sm bg-gray-200 p-1 rounded'>🥚 卵の検証</h3>
              <button onClick={handleCreateEgg} className='w-full bg-yellow-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                新しい卵を取得する
              </button>
              <button onClick={debugMaxHatchConditions} className='w-full bg-orange-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                孵化条件をすべてMAXにする
              </button>
              <button onClick={() => handleHatchEgg(true)} className='w-full bg-pink-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                条件無視で強制孵化させる
              </button>
            </div>

            <div className='space-y-2 mt-4'>
              <h3 className='font-bold text-sm bg-gray-200 p-1 rounded'>🐕 ペットの検証</h3>
              <button onClick={() => addExperience(1000)} className='w-full bg-blue-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                経験値 +1000 (レベルアップ)
              </button>
              <button
                onClick={() => {
                  const newDist = walkDistance + 1000;
                  setWalkDistance(newDist);
                  supabase.from('pets').update({ walk_distance_m: newDist }).eq('id', petId);
                }}
                className='w-full bg-green-500 text-white font-bold py-2 rounded-lg shadow text-sm'
              >
                歩行距離 +1000m
              </button>
              <button
                onClick={() => {
                  setPetCondition('sick');
                  setShowConditionSOS(true);
                  supabase.from('pets').update({ condition_status: 'sick' }).eq('id', petId);
                }}
                className='w-full bg-purple-500 text-white font-bold py-2 rounded-lg shadow text-sm'
              >
                強制的に「病気」にする
              </button>
              <button
                onClick={() => {
                  setPetCondition('starving');
                  setShowConditionSOS(true);
                  setHungerPercent(10);
                  supabase.from('pets').update({ condition_status: 'starving' }).eq('id', petId);
                }}
                className='w-full bg-red-500 text-white font-bold py-2 rounded-lg shadow text-sm'
              >
                強制的に「空腹(餓死寸前)」にする
              </button>
              <button onClick={() => triggerRainbowBridge(petId!, generation)} className='w-full bg-black text-white font-bold py-2 rounded-lg shadow text-sm'>
                🌈 寿命(虹の橋)テスト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- レベルアップエフェクトオーバーレイ --- */}
      {levelUpOverlay?.active && (
        <div className='pointer-events-none absolute inset-0 z-[140] overflow-hidden flex items-center justify-center'>
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
                transition: `transform ${p.duration}ms cubic-bezier(.2,.8,.2,1), opacity ${p.duration}ms linear`,
              }}
            />
          ))}
          <div className='absolute text-center drop-shadow-2xl animate-bounce'>
            <div className={`font-black italic tracking-wider ${levelUpOverlay.isMilestone ? 'text-6xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : 'text-5xl text-yellow-300 drop-shadow-md'}`}>
              LEVEL UP!
            </div>
            <div className='text-white text-3xl font-bold mt-2'>Lv. {levelUpOverlay.level}</div>
          </div>
        </div>
      )}

      {/* --- 孵化エフェクトオーバーレイ --- */}
      {hatchOverlay?.active && (
        <div className='pointer-events-none absolute inset-0 z-[130] overflow-hidden'>
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
                transition: `transform ${p.duration}ms cubic-bezier(.2,.8,.2,1), opacity ${p.duration}ms linear`,
              }}
            />
          ))}
          <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white drop-shadow-2xl pointer-events-none'>
            <div className='text-3xl font-extrabold'>{hatchOverlay.rarity === 'UR' ? '🌈 UR!' : hatchOverlay.rarity === 'SR' ? '✨ SR' : hatchOverlay.rarity === 'R' ? '⭐ R' : 'N'}</div>
          </div>
        </div>
      )}

      {/* --- 虹の橋（寿命）エフェクトオーバーレイ --- */}
      {showRainbowBridge && (
        <div className='absolute inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 text-center text-white transition-opacity duration-1000'>
          {rainbowPhase === 1 && (
            <div className='animate-pulse space-y-6'>
              <h1 className='text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400'>🌈 虹の橋を渡りました...</h1>
              <p className='text-lg text-gray-300'>
                {displayName}は寿命を全うし、虹の橋の向こう側へ旅立ちました。
                <br />
                これまで大切に育ててくれてありがとう。
              </p>
            </div>
          )}
          {rainbowPhase === 2 && (
            <div className='space-y-6 animate-fade-in-up'>
              <div className='text-6xl mb-4'>🏆</div>
              <h2 className='text-3xl font-bold text-yellow-300'>殿堂入りしました！</h2>
              <p className='text-md text-gray-200'>
                あなたのプロフィールに「殿堂入り: {hallOfFameCount + 1}」が記録されました。
                <br />
                そして、{displayName}の魂は次の世代へ引き継がれます...
              </p>
              <div className='bg-white/20 p-4 rounded-xl mt-4'>
                <ul className='text-sm text-left list-disc pl-5'>
                  <li>新しい卵にステータスの一部がボーナスとして付与されました</li>
                  <li>経験値、愛情度などが少し高い状態からスタートします</li>
                  <li>世代: 第{generation + 1}世代</li>
                </ul>
              </div>
              <button onClick={closeRainbowBridge} className='mt-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-8 rounded-full shadow-2xl hover:scale-105 transition-transform'>
                新しい命を迎える
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- 初回プロフィール設定モーダル --- */}
      {showProfileSetup && (
        <div className='absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4'>
          <form onSubmit={handleProfileSubmit} className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 relative'>
            <h2 className='text-xl font-bold text-center border-b pb-3 text-slate-800'>🎉 ようこそ Straid AR へ！</h2>
            <p className='text-xs text-gray-500 text-center mb-4'>サービス向上のため、情報を教えてください</p>

            <div className='flex gap-3'>
              <div className='flex-1'>
                <label className='block text-sm font-bold text-gray-700 mb-1'>あなたの誕生年</label>
                <input type='number' value={inputBirthYear} onChange={e => setInputBirthYear(e.target.value)} placeholder='1990' className='w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 text-black' required />
              </div>
              <div className='flex-1'>
                <label className='block text-sm font-bold text-gray-700 mb-1'>性別</label>
                <select value={inputGender} onChange={e => setInputGender(e.target.value)} className='w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 text-black' required>
                  <option value=''>選択...</option>
                  <option value='male'>男性</option>
                  <option value='female'>女性</option>
                  <option value='other'>その他</option>
                </select>
              </div>
            </div>
            <button disabled={isSetupSubmitting} className='w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg mt-4 disabled:bg-gray-400'>
              {isSetupSubmitting ? '保存中...' : 'はじめる！'}
            </button>
          </form>
        </div>
      )}

      {/* --- 名付け設定モーダル（孵化直後） --- */}
      {showNamingScreen && (
        <div className='absolute inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4'>
          <form onSubmit={handleNamingSubmit} className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 relative'>
            <h2 className='text-2xl font-bold text-center border-b pb-3 text-slate-800'>{isEgg ? '🥚 その卵に名前をつけよう！' : '✨ 誕生おめでとう！'}</h2>
            <p className='text-sm text-gray-600 text-center mb-4'>
              {isEgg ? (
                <>
                  「名無し」のままだと寂しいので
                  <br />
                  拾った卵に名前をつけてあげましょう
                </>
              ) : (
                <>
                  新しく生まれたペットに
                  <br />
                  名前をつけてあげましょう
                </>
              )}
            </p>

            <div>
              <label className='block text-sm font-bold text-gray-700 mb-1'>{isEgg ? '卵の名前' : 'ペットの名前'}</label>
              <input type='text' value={namingInput} onChange={e => setNamingInput(e.target.value)} placeholder='例: ポチ' className='w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-pink-500 text-black' required />
            </div>

            <button disabled={isNamingSubmitting || !namingInput.trim()} className='w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold py-3 rounded-xl shadow-lg mt-4 disabled:bg-gray-400 transition-transform active:scale-95'>
              {isNamingSubmitting ? '保存中...' : '名前を決定する！'}
            </button>
          </form>
        </div>
      )}

      {/* --- マインドフルネス機能 モーダル --- */}
      {showMindfulness && (
        <div className='absolute inset-0 z-[160] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white text-center'>
          {mindPhase === 'intro' && (
            <div className='space-y-6'>
              <div className='text-6xl animate-bounce'>🧘</div>
              <h2 className='text-2xl font-bold'>マインドフルネスしましょう</h2>
              <p className='text-gray-300'>
                ぺたるからの提案です。
                <br />
                少し立ち止まって、一緒に深呼吸をしませんか？
              </p>
              <button onClick={startMindfulness} className='bg-teal-500 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-teal-600'>
                はじめる
              </button>
              <button onClick={() => setShowMindfulness(false)} className='block w-full text-sm text-gray-400 mt-4 underline'>
                今はやめておく
              </button>
            </div>
          )}

          {(mindPhase === 'inhale' || mindPhase === 'hold' || mindPhase === 'exhale') && (
            <div className='space-y-8 flex flex-col items-center'>
              <h2 className='text-3xl font-bold'>
                {mindPhase === 'inhale' && '息を吸って...'}
                {mindPhase === 'hold' && '止めて...'}
                {mindPhase === 'exhale' && 'ゆっくり吐いて...'}
              </h2>
              <div className='relative flex items-center justify-center w-40 h-40'>
                <div className={`absolute w-full h-full border-4 border-teal-400 rounded-full transition-transform duration-1000 ease-in-out ${mindPhase === 'inhale' ? 'scale-150 opacity-50' : mindPhase === 'exhale' ? 'scale-75 opacity-100' : 'scale-150 opacity-100'}`}></div>
                <span className='text-5xl font-black'>{mindTime}</span>
              </div>
              <p className='text-gray-300 text-lg'>セット {mindSet} / 3</p>
            </div>
          )}

          {mindPhase === 'done' && (
            <div className='space-y-6 animate-fade-in'>
              <div className='text-6xl'>✨</div>
              <h2 className='text-2xl font-bold'>お疲れ様でした</h2>
              <p className='text-gray-300'>
                心が落ち着きましたね。
                <br />
                ご褒美にペットのごきげんと経験値が少しアップしました。
              </p>
              <button onClick={completeMindfulness} className='bg-teal-500 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-teal-600'>
                戻る
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- 地図でスポットを探すモーダル --- */}
      {isSpotMapOpen && (
        <div className='absolute inset-0 z-[320] bg-black/80 backdrop-blur-md flex items-center justify-center p-4' onClick={() => setIsSpotMapOpen(false)}>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative max-h-[90vh] flex flex-col' onClick={e => e.stopPropagation()}>
            <h2 className='text-xl font-bold text-center border-b pb-3 mb-4 text-slate-800'>🗺️ 周辺のスポット</h2>
            <button
              onClick={() => setIsSpotMapOpen(false)}
              className='absolute top-3 right-3 w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center active:scale-95'
              aria-label='地図を閉じる'
            >
              ✕
            </button>

            {!location ? (
              <p className='text-center text-gray-500 my-10'>GPS座標を取得中...</p>
            ) : (
              <div className='flex-1 overflow-y-auto pr-1'>
                <div className='relative w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-4 shadow-inner border border-gray-300'>
                  <iframe
                    width='100%'
                    height='100%'
                    frameBorder='0'
                    scrolling='no'
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.005}%2C${location.lat - 0.005}%2C${location.lng + 0.005}%2C${location.lat + 0.005}&layer=mapnik`}
                    className='absolute inset-0 z-0 pointer-events-none'
                  ></iframe>

                  <div className='absolute inset-0 z-10 flex items-center justify-center pointer-events-none'>
                    <div className='w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-md animate-pulse'></div>
                  </div>

                  <div className='absolute inset-0 z-20 pointer-events-none'>
                    {landmarks.map(spot => {
                      const master = spot.landmark_masters;
                      const facilityType = master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(spot.name);
                      const typeIcon = facilityType === 'hospital' ? '🏥' : facilityType === 'restaurant' ? '🍽️' : facilityType === 'hotel' ? '🏨' : '📍';

                      const topPercent = 50 - ((spot.latitude - location.lat) / 0.01) * 100;
                      const leftPercent = 50 + ((spot.longitude - location.lng) / 0.01) * 100;

                      return (
                        <div key={`radar-${spot.id}`} className='absolute w-8 h-8 -ml-4 -mt-4 text-xl flex items-center justify-center filter drop-shadow bg-white/90 rounded-full border border-gray-300 shadow-sm' style={{ top: `${topPercent}%`, left: `${leftPercent}%` }} title={spot.name}>
                          {typeIcon}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className='space-y-3'>
                  {landmarks.map(spot => {
                    const dist = getDistance(location.lat, location.lng, spot.latitude, spot.longitude);
                    const master = spot.landmark_masters;
                    const facilityType = master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(spot.name);

                    return (
                      <div key={`list-${spot.id}`} className='bg-gray-50 border rounded-xl p-3 flex justify-between items-center shadow-sm'>
                        <div>
                          <div className='font-bold text-gray-800 flex items-center gap-1'>
                            {facilityType === 'hospital' ? '🏥' : facilityType === 'restaurant' ? '🍽️' : facilityType === 'hotel' ? '🏨' : '📍'} {spot.name}
                          </div>
                          <div className='text-xs text-gray-500'>現在地から約 {Math.floor(dist)}m</div>
                        </div>
                        <button
                          onClick={() => {
                            handleModeChange('gps');
                            setIsSpotMapOpen(false);
                            setCameraFacing('environment');
                          }}
                          className='bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform'
                        >
                          ARで見る
                        </button>
                      </div>
                    );
                  })}
                  {landmarks.length === 0 && <p className='text-xs text-gray-500 text-center'>周辺にスポットが見つかりません</p>}
                </div>
              </div>
            )}

            <button onClick={() => setIsSpotMapOpen(false)} className='mt-4 w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl active:scale-95 transition-transform'>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* --- ウィークリーログインボーナス モーダル --- */}
      {loginBonusState.showModal && (
        <div className='absolute inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-black'>
            <h2 className='text-xl font-bold text-center mb-2 text-slate-800'>🎁 ログインボーナス</h2>
            <p className='text-sm text-gray-600 mb-6 text-center'>毎日ログインしてアイテムをゲットしよう！</p>

            <div className='grid grid-cols-4 gap-3 mb-6 w-full'>
              {[1, 2, 3, 4, 5, 6].map(day => (
                <div key={day} className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 ${loginBonusState.days >= day ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className='text-[10px] font-bold text-gray-500 mb-1'>{day}日目</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${loginBonusState.days >= day ? 'bg-orange-400 text-white' : 'bg-gray-200 text-transparent'}`}>✓</div>
                </div>
              ))}
              <div className={`col-span-2 flex flex-col items-center justify-center py-2 rounded-xl border-2 ${loginBonusState.days >= 7 ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-gray-50'}`}>
                <span className='text-[10px] font-bold text-gray-500 mb-1'>7日目 (ボーナス!)</span>
                <div className={`text-3xl ${loginBonusState.days >= 7 ? 'opacity-100 drop-shadow-md' : 'opacity-30 grayscale'}`}>🎁</div>
              </div>
            </div>

            {loginBonusState.gotBonus && (
              <div className='bg-pink-100 text-pink-800 p-3 rounded-xl font-bold w-full text-center mb-4 text-sm shadow-inner'>
                ✨「ログボご飯」をゲットしました！✨
                <br />
                <span className='text-xs font-normal'>もちものから使ってみよう！</span>
              </div>
            )}

            <button onClick={() => setLoginBonusState(prev => ({ ...prev, showModal: false }))} className='w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-colors'>
              受け取る
            </button>
          </div>
        </div>
      )}

      {/* --- お知らせ(News) モーダル --- */}
      {isNewsOpen && (
        <div className='absolute top-20 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200'>
          <div className='flex justify-between items-center mb-4 border-b pb-3'>
            <h3 className='font-bold text-xl text-gray-800'>📢 お知らせ</h3>
            <button onClick={() => setIsNewsOpen(false)} className='text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200'>
              閉じる
            </button>
          </div>

          <div className='space-y-4 max-h-[60vh] overflow-y-auto pr-1'>
            {userNotifications.length > 0 && (
              <div className='mb-4'>
                <h4 className='font-bold text-sm text-gray-500 mb-2 border-l-4 border-pink-500 pl-2'>あなたへのお知らせ</h4>
                <div className='space-y-2'>
                  {userNotifications.map(n => (
                    <div key={n.id} className='bg-pink-50 border border-pink-100 rounded-xl p-3'>
                      <h4 className='font-bold text-pink-900 text-sm mb-1'>{n.title}</h4>
                      <p className='text-xs text-gray-700 whitespace-pre-wrap'>{n.content}</p>
                      <div className='text-[10px] text-gray-500 mt-2 text-right'>{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className='font-bold text-sm text-gray-500 mb-2 border-l-4 border-blue-500 pl-2'>運営からのお知らせ</h4>
              {newsList.length === 0 ? (
                <p className='text-gray-500 text-center py-4 text-sm'>現在お知らせはありません</p>
              ) : (
                <div className='space-y-3'>
                  {newsList.map(news => (
                    <div key={news.id} className='bg-blue-50 border border-blue-100 rounded-xl p-3'>
                      <h4 className='font-bold text-blue-900 text-sm mb-1'>{news.title}</h4>
                      <p className='text-xs text-gray-700 whitespace-pre-wrap'>{news.content}</p>
                      <div className='text-[10px] text-gray-500 mt-2 text-right'>{new Date(news.published_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ステータスモーダル (画面に一瞬映る問題を解決) --- */}
      {isStatusModalOpen && (
        <div className='absolute inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4'>
          <div className='bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-white space-y-4'>
            <div className='flex justify-between items-center border-b border-gray-700 pb-3'>
              <h2 className='text-xl font-bold text-white'>📊 ステータス詳細</h2>
              <button onClick={() => setIsStatusModalOpen(false)} className='text-gray-400 hover:text-white font-bold px-3 py-1 bg-gray-800 rounded-full'>
                閉じる
              </button>
            </div>

            {isEgg && !isEggUnregistered && (
              <div className='space-y-3'>
                <div className='flex justify-between text-xs font-bold text-yellow-400'>
                  <span>
                    🥚 孵化条件 <span className='ml-2 text-gray-400'>第{generation}世代</span>
                  </span>
                  <span>{isHatchReady ? '準備完了！' : 'あと少し...'}</span>
                </div>
                <div className='space-y-2 text-xs'>
                  <div className='flex justify-between'>
                    <span>🚶 歩行 {Math.floor(walkDistance)} / {targetDistanceToHatch}m</span>
                    <span>{Math.floor(hatchProgress.distance * 100)}%</span>
                  </div>
                  <div className='w-full h-3 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-yellow-400' style={{ width: `${Math.min(100, hatchProgress.distance * 100)}%` }}></div>
                  </div>
                  <div className='flex justify-between'>
                    <span>🍚 給餌 {feedCount} / {targetFeedCount}回</span>
                    <span>{Math.floor(hatchProgress.feed * 100)}%</span>
                  </div>
                  <div className='w-full h-3 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-orange-400' style={{ width: `${Math.min(100, hatchProgress.feed * 100)}%` }}></div>
                  </div>
                  <div className='flex justify-between'>
                    <span>📍 ランドマーク {landmarkVisitCount} / {targetLandmarkVisits}回</span>
                    <span>{Math.floor(hatchProgress.landmark * 100)}%</span>
                  </div>
                  <div className='w-full h-3 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-cyan-400' style={{ width: `${Math.min(100, hatchProgress.landmark * 100)}%` }}></div>
                  </div>
                  <div className='flex justify-between'>
                    <span>✨ イベント {eventCount} / {targetEventCount}回</span>
                    <span>{Math.floor(hatchProgress.event * 100)}%</span>
                  </div>
                  <div className='w-full h-3 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-pink-400' style={{ width: `${Math.min(100, hatchProgress.event * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )}

            {!isEgg && !isEggUnregistered && petId && (
              <>
                <div className='space-y-4'>
                  <div>
                    <div className='flex justify-between text-xs font-bold text-gray-300 mb-1'>
                      <span>🍖 体力</span>
                      <span>{hungerPercent}%</span>
                    </div>
                    <div className='w-full h-3 bg-gray-800 rounded-full overflow-hidden'>
                      <div className={`h-full ${hungerPercent < 30 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${hungerPercent}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className='flex justify-between text-xs font-bold text-gray-300 mb-1'>
                      <span>💖 ごきげん</span>
                      <span>{motivationPercent}%</span>
                    </div>
                    <div className='w-full h-3 bg-gray-800 rounded-full overflow-hidden'>
                      <div className='h-full bg-gradient-to-r from-pink-400 to-pink-600' style={{ width: `${motivationPercent}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className='flex justify-between text-xs font-bold text-blue-300 mb-1'>
                      <span>
                        🌟 Lv.{level} <span className='text-[10px] text-gray-500 ml-1'>第{generation}世代</span>
                      </span>
                      <span>
                        EXP: {exp} / {expNeededForNextLevel}
                      </span>
                    </div>
                    <div className='w-full h-3 bg-gray-800 rounded-full overflow-hidden'>
                      <div className='h-full bg-blue-500' style={{ width: `${(exp / expNeededForNextLevel) * 100}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className='border-t border-gray-700 pt-4 mt-2 space-y-3 text-xs text-gray-300'>
                  <div className='font-bold text-indigo-300 mb-2'>🔜 次のレベルアップ条件</div>
                  <div className='flex justify-between'>
                    <span>🚶 歩行 {Math.floor(walkDistance)} / {nextLevelRequirements.distance}m</span>
                    <span>{Math.floor(Math.min(100, (walkDistance / nextLevelRequirements.distance) * 100))}%</span>
                  </div>
                  <div className='w-full h-2 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-indigo-400' style={{ width: `${Math.min(100, (walkDistance / nextLevelRequirements.distance) * 100)}%` }}></div>
                  </div>
                  <div className='flex justify-between'>
                    <span>🍚 給餌 {feedCount} / {nextLevelRequirements.feed}回</span>
                    <span>{Math.floor(Math.min(100, (feedCount / nextLevelRequirements.feed) * 100))}%</span>
                  </div>
                  <div className='w-full h-2 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-orange-400' style={{ width: `${Math.min(100, (feedCount / nextLevelRequirements.feed) * 100)}%` }}></div>
                  </div>
                  <div className='flex justify-between'>
                    <span>📍 ランドマーク {landmarkVisitCount} / {nextLevelRequirements.landmark}回</span>
                    <span>{Math.floor(Math.min(100, (landmarkVisitCount / nextLevelRequirements.landmark) * 100))}%</span>
                  </div>
                  <div className='w-full h-2 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-cyan-400' style={{ width: `${Math.min(100, (landmarkVisitCount / nextLevelRequirements.landmark) * 100)}%` }}></div>
                  </div>
                  <div className='flex justify-between'>
                    <span>✨ イベント {eventCount} / {nextLevelRequirements.event}回</span>
                    <span>{Math.floor(Math.min(100, (eventCount / nextLevelRequirements.event) * 100))}%</span>
                  </div>
                  <div className='w-full h-2 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-pink-400' style={{ width: `${Math.min(100, (eventCount / nextLevelRequirements.event) * 100)}%` }}></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- 状態異常SOS モーダル --- */}
      {showConditionSOS && !isEgg && petCondition !== 'healthy' && (
        <div className='absolute top-24 left-4 right-4 z-[100] animate-bounce'>
          <div className={`p-4 rounded-2xl shadow-2xl border-4 flex items-start gap-4 ${petCondition === 'sick' ? 'bg-purple-100 border-purple-400 text-purple-900' : 'bg-red-100 border-red-400 text-red-900'}`}>
            <div className='text-4xl'>{petCondition === 'sick' ? '🏥' : '🍽️'}</div>
            <div className='flex-1'>
              <h3 className='font-bold text-lg mb-1'>{petCondition === 'sick' ? '体調不良です！' : 'お腹が減って動けません！'}</h3>
              <p className='text-xs font-bold mb-3'>
                {petCondition === 'sick' ? '病気になってしまいました。マップを開いて【病院 (ドクター)】へ連れて行ってください！' : '飢餓状態です。マップを開いて【ご飯屋さん (レストラン)】へ連れて行ってください！'}
              </p>
              <button onClick={() => { setIsSpotMapOpen(true); setShowConditionSOS(false); playSound('tap'); }} className={`w-full py-2 rounded-xl text-white font-bold text-sm shadow active:scale-95 ${petCondition === 'sick' ? 'bg-purple-600' : 'bg-red-600'}`}>
                マップで施設を探す
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- UIレイヤー (ヘッダー: スッキリ化) --- */}
      {sessionUserId && viewMode !== 'report' && (
        <div className='absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none'>
          <div className='flex justify-between items-end'>
            <span className='text-white font-bold text-3xl drop-shadow-lg bg-black/30 px-3 py-1 rounded-xl backdrop-blur-sm'>{isEggUnregistered ? '' : displayName}</span>
            <span className={`${currentMood.color} text-white px-4 py-2 rounded-xl font-bold shadow-xl text-md transition-colors duration-300 border border-white/20`}>{currentMood.text}</span>
          </div>
        </div>
      )}

      {/* --- 右上ボタン群 --- */}
      {viewMode !== 'report' && (
        <div className='absolute top-20 right-4 z-[140] flex flex-col gap-4 pointer-events-auto'>
          {/* ステータス確認ボタン (追加) */}
          {!isEggUnregistered && (
            <button onClick={() => { setIsStatusModalOpen(true); playSound('tap'); }} className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 flex items-center justify-center w-14 h-14 relative' aria-label='ステータス'>
              <span className='text-2xl'>📊</span>
              {isEgg && isHatchReady && <span className='absolute top-0 right-0 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white animate-pulse'></span>}
            </button>
          )}

          <button onClick={() => { setIsNewsOpen(true); playSound('tap'); }} className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 flex items-center justify-center w-14 h-14 relative' aria-label='お知らせ'>
            <span className='text-2xl'>📢</span>
            {(newsList.length > 0 || userNotifications.length > 0) && <span className='absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white'></span>}
          </button>

          {viewMode === 'gps' && activeLandmark ? (
            <>
              <button
                onClick={() => {
                  setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'));
                  setSceneKey(k => k + 1);
                  setCameraReady(false);
                  playSound('tap');
                }}
                className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14'
                aria-label='カメラ切替'
              >
                <span className='text-2xl'>🔄</span>
              </button>
              <button onClick={takeSnapshot} className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14' aria-label='写真を撮る'>
                <span className='text-2xl'>📸</span>
              </button>
            </>
          ) : viewMode === 'mindar' ? (
            <button onClick={takeSnapshot} className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 transition-transform flex items-center justify-center w-14 h-14' aria-label='写真を撮る'>
              <span className='text-2xl'>📸</span>
            </button>
          ) : null}
        </div>
      )}

      {gameOverNotice && (
        <div className='absolute inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4'>
            <div className='text-4xl'>💀</div>
            <h2 className='text-xl font-bold text-red-600'>ゲームオーバー</h2>
            <p className='text-sm text-gray-700 whitespace-pre-wrap'>{gameOverNotice}</p>
            <button onClick={() => setGameOverNotice(null)} className='w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg'>
              卵を確認する
            </button>
          </div>
        </div>
      )}

      {/* --- きろく（Report）画面 --- */}
      {viewMode === 'report' && (
        <div className='absolute inset-0 z-30 bg-black/90 text-white overflow-y-auto pb-32 pt-10 px-6 backdrop-blur-md'>
          <h2 className='text-3xl font-bold mb-6 text-center text-purple-400'>📊 育成とマインドフルネスの記録</h2>
          <div className='space-y-6'>
            <div className='bg-gray-800 p-5 rounded-2xl border border-purple-500/30 shadow-lg'>
              <h3 className='font-bold text-xl mb-3 border-b border-gray-600 pb-2'>🏃 ウォーキング記録</h3>
              <p className='text-4xl font-black text-cyan-400'>
                {Math.floor(walkDistance)} <span className='text-sm font-normal text-gray-300'>m</span>
              </p>
              <p className='text-md text-gray-400 mt-1'>推定歩数: 約 {stepCount} 歩</p>
            </div>

            <div className='bg-gray-800 p-5 rounded-2xl border border-teal-500/30 shadow-lg'>
              <h3 className='font-bold text-xl mb-3 border-b border-gray-600 pb-2'>🧘 マインドフルネス記録</h3>
              <p className='text-4xl font-black text-teal-400'>
                {mindfulnessLogCount} <span className='text-sm font-normal text-gray-300'>回 実行</span>
              </p>
              <p className='text-md text-gray-400 mt-1'>心の平穏とペットへの愛情度が記録されています。</p>

              <div className='mt-4 grid grid-cols-2 gap-4'>
                <div className='bg-gray-700 p-3 rounded-xl text-center shadow-inner'>
                  <div className='text-xs text-gray-400'>現在の愛情度</div>
                  <div className='text-xl font-bold text-pink-400'>💖 {Math.floor(affection)}</div>
                </div>
                <div className='bg-gray-700 p-3 rounded-xl text-center shadow-inner'>
                  <div className='text-xs text-gray-400'>ごきげん</div>
                  <div className='text-xl font-bold text-orange-400'>✨ {motivationPercent}%</div>
                </div>
              </div>
            </div>

            <div className='bg-gray-800 p-5 rounded-2xl border border-yellow-500/30 shadow-lg'>
              <h3 className='font-bold text-xl mb-3 border-b border-gray-600 pb-2'>📋 アクティビティ総数</h3>
              <ul className='space-y-3 text-gray-300'>
                <li className='flex justify-between items-center bg-gray-700/50 p-3 rounded-lg'>
                  <span>殿堂入り達成</span> <span className='font-bold text-yellow-400 text-lg'>🏆 {hallOfFameCount} 回</span>
                </li>
                <li className='flex justify-between items-center bg-gray-700/50 p-3 rounded-lg'>
                  <span>ごはんをあげた回数</span> <span className='font-bold text-lg'>🍚 {feedCount} 回</span>
                </li>
                <li className='flex justify-between items-center bg-gray-700/50 p-3 rounded-lg'>
                  <span>スポットを訪れた回数</span> <span className='font-bold text-lg'>📍 {landmarkVisitCount} 回</span>
                </li>
                <li className='flex justify-between items-center bg-gray-700/50 p-3 rounded-lg'>
                  <span>なでた回数</span> <span className='font-bold text-lg'>✨ {eventCount} 回</span>
                </li>
                <li className='flex justify-between items-center bg-gray-700/50 p-3 rounded-lg'>
                  <span>現在のレベル</span> <span className='font-bold text-yellow-400 text-lg'>🌟 Lv. {level}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

        {/* --- UIレイヤー (ボトム) --- */}
      <div
        className='absolute bottom-0 left-0 right-0 z-[130] p-4 flex flex-col gap-4 pointer-events-auto'
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 24px))' }}
      >
        {isShopOpen && (
          <div className='absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200'>
            <div className='flex justify-between items-center mb-4 border-b pb-3'>
              <h3 className='font-bold text-xl text-gray-800'>🛒 おみせ</h3>
              <button onClick={() => setIsShopOpen(false)} className='text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200'>
                閉じる
              </button>
            </div>
            {shopItems.length === 0 ? (
              <p className='text-gray-500 text-center py-8'>現在販売中のアイテムはありません</p>
            ) : (
              <div className='grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1'>
                {shopItems.map(item => (
                  <div key={item.id} className='bg-white border rounded-2xl p-3 flex flex-col shadow-sm'>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className='w-full h-24 object-cover rounded-xl mb-2 bg-gray-100' />
                    ) : (
                      <div className='w-full h-24 bg-blue-50 rounded-xl mb-2 flex items-center justify-center text-3xl'>🎁</div>
                    )}
                    <h4 className='font-bold text-gray-800 text-sm leading-tight mb-1'>{item.name}</h4>
                    <span className='text-[10px] text-gray-500 mb-2 line-clamp-2 leading-tight'>{item.description}</span>
                    <div className='mt-auto flex items-center justify-between'>
                      <span className='font-bold text-blue-600 text-sm'>¥{item.price_jpy}</span>
                      <button onClick={() => handleBuyItem(item)} className='bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95'>
                        購入
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isInventoryOpen && (
          <div className='absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200'>
            <div className='flex justify-between items-center mb-4 border-b pb-3'>
              <h3 className='font-bold text-xl text-gray-800'>🎒 もちもの</h3>
              <button onClick={() => setIsInventoryOpen(false)} className='text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200'>
                閉じる
              </button>
            </div>
            {inventory.length === 0 ? (
              <p className='text-gray-500 text-center py-8'>アイテムを持っていません。</p>
            ) : (
              <div className='flex gap-4 overflow-x-auto pb-2'>
                {inventory.map(invItem => (
                  <button key={invItem.id} onClick={() => handleUseItem(invItem)} className='flex-shrink-0 bg-white border border-blue-100 rounded-2xl p-3 w-32 flex flex-col text-left shadow-sm active:scale-95 transition-transform'>
                    {invItem.item_masters.image_url ? (
                      <img src={invItem.item_masters.image_url} className='w-full h-16 object-cover rounded-lg mb-2' />
                    ) : (
                      <div className='w-full h-16 bg-blue-50 rounded-lg mb-2 flex items-center justify-center text-2xl'>📦</div>
                    )}
                    <div className='font-bold text-blue-900 text-sm truncate'>{invItem.item_masters.name}</div>
                    <div className='mt-auto text-right text-xs font-bold text-blue-600 pt-2'>所持: {invItem.quantity}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'mindar' && isEggUnregistered && sessionUserId && (
          detectedTargetIndex !== null ? (
            <button onClick={handleCreateEgg} className='bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-2xl font-bold shadow-lg w-full animate-pulse text-lg border-4 border-yellow-200'>
              🥚 不思議な卵を発見！
              <br />
              <span className='text-sm'>タップして拾い上げる</span>
            </button>
          ) : (
            <div className='bg-gray-800/80 text-white p-4 rounded-2xl font-bold text-center text-sm shadow-lg w-full border-2 border-gray-600'>
              📷 マーカーにカメラを向けてください
            </div>
          )
        )}

        {viewMode === 'mindar' && isEgg && !isEggUnregistered && isHatchReady && petId && (
          <button onClick={() => handleHatchEgg(false)} className='bg-gradient-to-r from-pink-400 to-red-500 text-white p-4 rounded-2xl font-bold shadow-lg w-full animate-bounce text-lg border-4 border-pink-200'>
            ✨ 卵が割れそうだ！
            <br />
            <span className='text-sm'>タップして孵化させる</span>
          </button>
        )}

        {viewMode === 'mindar' && !isEgg && !isEggUnregistered && petId && (
          <div className='flex gap-2 w-full'>
            <button onClick={handleFeed} disabled={isSleeping || hungerPercent === 100 || petCondition === 'sick'} className={`flex-[2] text-white py-3 rounded-2xl font-bold shadow-lg transition-all ${(isSleeping || hungerPercent === 100 || petCondition === 'sick') ? 'bg-gray-400 opacity-80' : 'bg-gradient-to-br from-orange-400 to-orange-600 active:scale-95'}`}>
              🍚
              <br />
              <span className='text-xs'>ごはん</span>
            </button>
            <button onClick={() => { setIsInventoryOpen(true); setIsShopOpen(false); setIsNewsOpen(false); playSound('tap'); }} className='flex-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center'>
              🎒
              <br />
              <span className='text-xs'>もちもの</span>
            </button>
            <button onClick={() => { setIsShopOpen(true); setIsInventoryOpen(false); setIsNewsOpen(false); playSound('tap'); }} className='flex-1 bg-gradient-to-br from-green-500 to-green-700 text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center'>
              🛒
              <br />
              <span className='text-xs'>おみせ</span>
            </button>
          </div>
        )}

        {viewMode === 'gps' && (
          <>
            <div className='bg-green-600/90 text-white p-3 rounded-xl font-bold shadow-lg w-full text-center text-sm backdrop-blur-sm'>
              {location ? `🚶‍♂️ 現在地周辺を散歩中... ${petId ? `(歩行: ${Math.floor(walkDistance)}m / 約${stepCount}歩)` : ''}` : '📡 GPSを探索中...'}
            </div>
            {activeLandmark && !isEgg && petId && (
              <button
                onClick={handleCheckIn}
                className={`p-4 rounded-2xl font-bold shadow-2xl w-full border-4 animate-bounce text-lg text-white 
                  ${(activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hospital'
                    ? 'bg-gradient-to-br from-purple-400 to-purple-600 border-purple-200'
                    : (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'restaurant'
                    ? 'bg-gradient-to-br from-red-400 to-red-600 border-red-200'
                    : (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hotel'
                    ? 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-200'
                    : 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-200 text-yellow-900'}`}
              >
                ✨ 【{activeLandmark.name}】を発見！
                <br />
                タップしてチェックイン！
              </button>
            )}
          </>
        )}

        {viewMode !== 'report' && (
          <button
            onClick={() => { setIsSpotMapOpen(true); playSound('tap'); }}
            className='bg-gradient-to-r from-teal-400 to-teal-600 text-white p-3 rounded-2xl font-bold shadow-lg w-full flex justify-center items-center gap-2 border-2 border-teal-300 active:scale-95 transition-transform text-lg'
          >
            🗺️ 地図でスポットを探す
          </button>
        )}

        <div className='grid grid-cols-4 gap-1 bg-white p-3 rounded-2xl shadow-xl border border-gray-100'>
          <button onClick={() => handleModeChange('mindar')} className={`min-w-0 font-bold flex flex-col items-center gap-1 ${viewMode === 'mindar' ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className='text-xl'>🏠</span>
            <span className='text-xs'>おうち</span>
          </button>
          <button onClick={() => handleModeChange('gps')} className={`min-w-0 font-bold flex flex-col items-center gap-1 ${viewMode === 'gps' ? 'text-green-600' : 'text-gray-400'}`}>
            <span className='text-xl'>🚶</span>
            <span className='text-xs'>さんぽ</span>
          </button>
          <button
            onClick={() => {
              setIsInventoryOpen(true);
              setIsShopOpen(false);
              setIsNewsOpen(false);
              playSound('tap');
            }}
            className={`min-w-0 font-bold flex flex-col items-center gap-1 relative ${isInventoryOpen ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <span className='relative text-xl'>
              🎒
              {inventory.reduce((total, entry) => total + entry.quantity, 0) > 0 && (
                <span className='absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 border border-white text-[10px] leading-4 text-white'>
                  {inventory.reduce((total, entry) => total + entry.quantity, 0)}
                </span>
              )}
            </span>
            <span className='text-xs'>もちもの</span>
          </button>
          <button onClick={() => handleModeChange('report')} className={`min-w-0 font-bold flex flex-col items-center gap-1 ${viewMode === 'report' ? 'text-purple-600' : 'text-gray-400'}`}>
            <span className='text-xl'>📊</span>
            <span className='text-xs'>きろく</span>
          </button>
        </div>
      </div>

      {/* --- 背面：ARレイヤー。refの範囲内でのみカメラを表示する。 --- */}
      <div ref={arViewportRef} className='ar-camera-viewport absolute inset-0 z-[1] pointer-events-none'>
        {viewMode === 'mindar' && sessionUserId && isDataLoaded && scriptsReadyForMindar && !isSwitchingMode && (
          <div key={`mindar-container-${sceneKey}`} className='absolute inset-0 pointer-events-none'>
            <a-scene
              embedded
              style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', pointerEvents: 'none' }}
              mindar-image={`imageTargetSrc: ${petMarkerUrl}; autoStart: true; uiLoading: no; uiError: no; maxTrack: 1;`}
              renderer='alpha: true; preserveDrawingBuffer: true; colorManagement: true; physicallyCorrectLights: true;'
              color-space='sRGB'
              vr-mode-ui='enabled: false'
              device-orientation-permission-ui='enabled: false'
            >
              <a-assets>
                <a-asset-item id='pet-asset' src={activeModelUrl}></a-asset-item>
              </a-assets>
              <a-light type='ambient' color='#ffffff' intensity='0.5'></a-light>
              <a-light type='directional' color='#ffffff' intensity='1.5' position='-1 2 1' castShadow='true'></a-light>
              <a-camera position='0 0 0' look-controls='enabled: false' cursor='rayOrigin: mouse;' raycaster='objects: .clickable'></a-camera>

              <a-entity mindar-image-target='targetIndex: 0' id='marker-target-0'>
                <a-gltf-model
                  id='pet-model-0'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  rotation='0 0 0'
                  position='0 0 0'
                  scale={hatchAnimating ? '0.1 0.1 0.1' : '0.5 0.5 0.5'}
                  src={activeModelUrl}
                  shadow='cast: true; receive: true'
                  animation-mixer={isEgg ? '' : `clip: ${actionAnim || currentMood.clip}; loop: ${actionAnim ? 'once' : 'repeat'}; crossFadeDuration: 0.3;`}
                  animation={hatchAnimating ? 'property: scale; to: 0.5 0.5 0.5; dur: 800; easing: easeOutElastic;' : undefined}
                ></a-gltf-model>
              </a-entity>
              <a-entity mindar-image-target='targetIndex: 1' id='marker-target-1'>
                <a-gltf-model
                  id='pet-model-1'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  rotation='0 0 0'
                  position='0 0 0'
                  scale={hatchAnimating ? '0.1 0.1 0.1' : '0.5 0.5 0.5'}
                  src={activeModelUrl}
                  shadow='cast: true; receive: true'
                  animation-mixer={isEgg ? '' : `clip: ${actionAnim || currentMood.clip}; loop: ${actionAnim ? 'once' : 'repeat'}; crossFadeDuration: 0.3;`}
                  animation={hatchAnimating ? 'property: scale; to: 0.5 0.5 0.5; dur: 800; easing: easeOutElastic;' : undefined}
                ></a-gltf-model>
              </a-entity>
              <a-entity mindar-image-target='targetIndex: 2' id='marker-target-2'>
                <a-gltf-model
                  id='pet-model-2'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  rotation='0 0 0'
                  position='0 0 0'
                  scale={hatchAnimating ? '0.1 0.1 0.1' : '0.5 0.5 0.5'}
                  src={activeModelUrl}
                  shadow='cast: true; receive: true'
                  animation-mixer={isEgg ? '' : `clip: ${actionAnim || currentMood.clip}; loop: ${actionAnim ? 'once' : 'repeat'}; crossFadeDuration: 0.3;`}
                  animation={hatchAnimating ? 'property: scale; to: 0.5 0.5 0.5; dur: 800; easing: easeOutElastic;' : undefined}
                ></a-gltf-model>
              </a-entity>
              <a-entity mindar-image-target='targetIndex: 3' id='marker-target-3'>
                <a-gltf-model
                  id='pet-model-3'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  rotation='0 0 0'
                  position='0 0 0'
                  scale={hatchAnimating ? '0.1 0.1 0.1' : '0.5 0.5 0.5'}
                  src={activeModelUrl}
                  shadow='cast: true; receive: true'
                  animation-mixer={isEgg ? '' : `clip: ${actionAnim || currentMood.clip}; loop: ${actionAnim ? 'once' : 'repeat'}; crossFadeDuration: 0.3;`}
                  animation={hatchAnimating ? 'property: scale; to: 0.5 0.5 0.5; dur: 800; easing: easeOutElastic;' : undefined}
                ></a-gltf-model>
              </a-entity>
            </a-scene>
          </div>
        )}
        {viewMode === 'gps' && isDataLoaded && scriptsReadyForGps && !isSwitchingMode && (
          <div key={`gps-container-${sceneKey}-${cameraFacing}`} className='absolute inset-0 pointer-events-none'>
            <a-scene
              embedded
              style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', pointerEvents: 'none' }}
              vr-mode-ui='enabled: false'
              renderer='alpha: true; preserveDrawingBuffer: true; colorManagement: true;'
              arjs={`sourceType: webcam; videoTexture: true; debugUIEnabled: false; facingMode: ${cameraFacing};`}
            >
              <a-assets>
                <a-asset-item id='pet-asset-gps' src={activeModelUrl}></a-asset-item>
                {activeLandmark && activeLandmark.model_url && (
                  <a-asset-item id='landmark-asset-dynamic' src={activeLandmark.model_url}></a-asset-item>
                )}
              </a-assets>

              <a-light type='ambient' color='#ffffff' intensity='0.7'></a-light>
              <a-light type='directional' color='#ffffff' intensity='1.5' position='0 5 0'></a-light>

              <a-camera gps-camera rotation-reader>
                {!isEgg && petId && (
                  <a-entity
                    gltf-model={activeModelUrl}
                    scale='1.5 1.5 1.5'
                    position={`0 -1.5 ${cameraFacing === 'user' ? '-2' : '-4'}`}
                    rotation='0 180 0'
                    animation-mixer={`clip: ${petCondition !== 'healthy' ? 'Sad' : 'Walk'}; loop: repeat; crossFadeDuration: 0.3;`}
                  ></a-entity>
                )}
              </a-camera>

              {activeLandmark && !isEgg && petId && (
                <a-entity
                  gps-entity-place={`latitude: ${activeLandmark.latitude}; longitude: ${activeLandmark.longitude};`}
                  gltf-model={activeLandmark.model_url ? '#landmark-asset-dynamic' : '/models/treasure.glb'}
                  scale='5 5 5'
                  position='0 2 0'
                  animation='property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear;'
                ></a-entity>
              )}
            </a-scene>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeARPage() {
  return (
    <Suspense fallback={<div className='bg-black w-full h-full text-white flex items-center justify-center'>ARエンジンを起動中...</div>}>
      <HomeAR />
    </Suspense>
  );
}
