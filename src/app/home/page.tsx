'use client';

import { useState, useEffect, useMemo, Suspense, useRef, useCallback, type FormEvent } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { isDebugMode } from '@/utils/debugMode';

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'a-scene': any;
        'a-assets': any;
        'a-asset-item': any;
        'a-light': any;
        'a-camera': any;
        'a-entity': any;
        'a-gltf-model': any;
        'a-box': any;
        [elemName: string]: any;
      }
    }
  }
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

const ModelViewer = 'model-viewer' as any;

type ItemActionEffect = {
  kind: 'food' | 'medicine' | 'sleep' | 'exp';
  emoji: string;
  reactionMood: 'happy' | 'sleepy' | 'surprised';
  petAnim: Array<{ clip: string; delay: number }>;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  arcLift: number;
  trailColor: string;
};

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

  const [eggModelUrl, setEggModelUrl] = useState('/models/eggs/egg.glb');
  const [petModelUrlV1, setPetModelUrlV1] = useState('/models/pet/N/v1.glb');
  const [petModelUrlV2, setPetModelUrlV2] = useState<string | null>(null);
  const [petModelUrlV3, setPetModelUrlV3] = useState<string | null>(null);
  const [petMasterName, setPetMasterName] = useState('名無し');
  const [petRarity, setPetRarity] = useState('?');

  const [petAttributes, setPetAttributes] = useState<any[]>([]);
  const [petAttributeWeaknesses, setPetAttributeWeaknesses] = useState<any[]>([]); 
  const [petAffinities, setPetAffinities] = useState<any[]>([]);

  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
  const [encyclopediaTab, setEncyclopediaTab] = useState<'pets' | 'spots'>('pets');
  const [allPetMasters, setAllPetMasters] = useState<any[]>([]);
  const [acquiredPetIds, setAcquiredPetIds] = useState<Set<string>>(new Set());
  const [hallOfFamePetIds, setHallOfFamePetIds] = useState<Set<string>>(new Set());
  const [customSpots, setCustomSpots] = useState<any[]>([]);

  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotFile, setNewSpotFile] = useState<File | null>(null);
  const [isUploadingSpot, setIsUploadingSpot] = useState(false);

  const [viewMode, setViewMode] = useState<'mindar' | 'gps' | 'report'>((modeParam === 'gps' || modeParam === 'report') ? (modeParam as 'mindar' | 'gps' | 'report') : 'mindar');
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  const [mindarLoaded, setMindarLoaded] = useState(false);
  const [arjsLoaded, setArjsLoaded] = useState(false);

  const scriptsReadyForMindar = aframeLoaded && extrasLoaded && mindarLoaded;
  const scriptsReadyForGps = aframeLoaded && arjsLoaded;

  const [gpsEverActivated, setGpsEverActivated] = useState(viewMode === 'gps');
  useEffect(() => {
    if (viewMode === 'gps') setGpsEverActivated(true);
  }, [viewMode]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraTrulyReady, setCameraTrulyReady] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const [feedCount, setFeedCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [landmarkVisitCount, setLandmarkVisitCount] = useState(0);
  const [mindfulnessLogCount, setMindfulnessLogCount] = useState(0);
  const [hallOfFameCount, setHallOfFameCount] = useState(0);

  const [hatchOverlay, setHatchOverlay] = useState<{ active: boolean; particles: any[]; rarity: string; petName?: string; showConfirm: boolean; resolve?: () => void } | null>(null);
  const [itemRewardOverlay, setItemRewardOverlay] = useState<{ active: boolean; items: any[]; facilityName: string; facilityIcon: string } | null>(null);

  const petMarkerUrl = '/markers/targets.mind';
  const MARKER_COUNT = 4;

  const MODEL_SCALE = 0.5;
  const [debugScaleX, setDebugScaleX] = useState(MODEL_SCALE);
  const [debugScaleY, setDebugScaleY] = useState(MODEL_SCALE);
  const [debugScaleZ, setDebugScaleZ] = useState(MODEL_SCALE);
  const [debugRotX, setDebugRotX] = useState(0);
  const [debugRotY, setDebugRotY] = useState(0);
  const [debugRotZ, setDebugRotZ] = useState(0);
  const [debugAnimEnabled, setDebugAnimEnabled] = useState(true);
  const [debugBoxScale, setDebugBoxScale] = useState(5);

  const [debugSelectedPetId, setDebugSelectedPetId] = useState<string>('');
  const [detectedTargetIndex, setDetectedTargetIndex] = useState<number | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isEffectEnabled, setIsEffectEnabled] = useState(true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);

  const isSoundEnabledRef = useRef(isSoundEnabled);
  useEffect(() => { isSoundEnabledRef.current = isSoundEnabled; }, [isSoundEnabled]);
  const isEffectEnabledRef = useRef(isEffectEnabled);
  useEffect(() => { isEffectEnabledRef.current = isEffectEnabled; }, [isEffectEnabled]);

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
    if (!isSoundEnabledRef.current) return;
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
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn(`サウンド再生に失敗しました (${name}):`, err);
      });
    } catch (err) {
      console.warn('playSound error:', err);
    }
  }, []);

  const playItemEffectSound = useCallback((kind: ItemActionEffect['kind']) => {
    if (!isSoundEnabledRef.current) return;
    if (typeof window === 'undefined') return;
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const now = ctx.currentTime;
    const map: Record<ItemActionEffect['kind'], Array<{ type: OscillatorType; freq: number; gain: number; delay: number; duration: number }>> = {
      food: [
        { type: 'sine', freq: 440, gain: 0.08, delay: 0.00, duration: 0.28 },
        { type: 'triangle', freq: 620, gain: 0.07, delay: 0.10, duration: 0.24 },
        { type: 'sine', freq: 780, gain: 0.04, delay: 0.24, duration: 0.18 },
      ],
      medicine: [
        { type: 'square', freq: 180, gain: 0.09, delay: 0.00, duration: 0.15 },
        { type: 'sawtooth', freq: 420, gain: 0.08, delay: 0.12, duration: 0.22 },
        { type: 'triangle', freq: 700, gain: 0.06, delay: 0.22, duration: 0.30 },
      ],
      sleep: [
        { type: 'sine', freq: 300, gain: 0.07, delay: 0.00, duration: 0.28 },
        { type: 'triangle', freq: 240, gain: 0.06, delay: 0.16, duration: 0.36 },
        { type: 'sine', freq: 170, gain: 0.05, delay: 0.34, duration: 0.32 },
      ],
      exp: [
        { type: 'sine', freq: 520, gain: 0.08, delay: 0.00, duration: 0.18 },
        { type: 'triangle', freq: 820, gain: 0.07, delay: 0.12, duration: 0.20 },
        { type: 'sine', freq: 1100, gain: 0.05, delay: 0.24, duration: 0.20 },
      ],
    };

    const tones = map[kind];
    tones.forEach((tone, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, now + tone.delay);
      if (index > 0) {
        osc.frequency.exponentialRampToValueAtTime(tone.freq * (kind === 'sleep' ? 0.85 : 1.18), now + tone.delay + tone.duration);
      }
      gain.gain.setValueAtTime(0.0001, now + tone.delay);
      gain.gain.exponentialRampToValueAtTime(tone.gain, now + tone.delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.delay + tone.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + tone.delay);
      osc.stop(now + tone.delay + tone.duration + 0.05);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1600);
  }, []);

  const triggerItemActionEffect = useCallback((kind: ItemActionEffect['kind']) => {
    if (!isEffectEnabledRef.current) return;
    const configMap: Record<ItemActionEffect['kind'], Omit<ItemActionEffect, 'kind'>> = {
      food: {
        emoji: '🍙',
        reactionMood: 'happy',
        petAnim: [
          { clip: 'Happy', delay: 540 },
          { clip: 'Jump', delay: 680 },
          { clip: 'Happy', delay: 640 },
          { clip: 'Fly', delay: 720 },
          { clip: 'Happy', delay: 700 },
          { clip: 'Jump', delay: 680 },
          { clip: 'Happy', delay: 700 },
        ],
        duration: 4200,
        startX: 10,
        startY: 78,
        endX: 62,
        endY: 41,
        arcLift: 52,
        trailColor: 'rgba(251,146,60,0.95)',
      },
      medicine: {
        emoji: '💉',
        reactionMood: 'surprised',
        petAnim: [
          { clip: 'Jump', delay: 560 },
          { clip: 'Fly', delay: 820 },
          { clip: 'Jump', delay: 760 },
          { clip: 'Happy', delay: 700 },
          { clip: 'Fly', delay: 840 },
          { clip: 'Jump', delay: 780 },
          { clip: 'Happy', delay: 760 },
        ],
        duration: 5000,
        startX: 94,
        startY: 62,
        endX: 52,
        endY: 46,
        arcLift: 34,
        trailColor: 'rgba(34,211,238,0.95)',
      },
      sleep: {
        emoji: '💤',
        reactionMood: 'sleepy',
        petAnim: [
          { clip: 'Sleep', delay: 820 },
          { clip: 'Happy', delay: 500 },
          { clip: 'Sleep', delay: 900 },
          { clip: 'Happy', delay: 620 },
          { clip: 'Sleep', delay: 960 },
          { clip: 'Happy', delay: 700 },
          { clip: 'Sleep', delay: 980 },
          { clip: 'Happy', delay: 600 },
          { clip: 'Sleep', delay: 1000 },
        ],
        duration: 6200,
        startX: 10,
        startY: 60,
        endX: 52,
        endY: 40,
        arcLift: 28,
        trailColor: 'rgba(129,140,248,0.9)',
      },
      exp: {
        emoji: '✨',
        reactionMood: 'surprised',
        petAnim: [
          { clip: 'Jump', delay: 620 },
          { clip: 'Happy', delay: 540 },
          { clip: 'Fly', delay: 760 },
          { clip: 'Jump', delay: 820 },
          { clip: 'Happy', delay: 660 },
          { clip: 'Fly', delay: 880 },
          { clip: 'Jump', delay: 720 },
        ],
        duration: 4700,
        startX: 18,
        startY: 72,
        endX: 52,
        endY: 38,
        arcLift: 46,
        trailColor: 'rgba(250,204,21,0.9)',
      },
    };

    const nextEffect: ItemActionEffect = { kind, ...configMap[kind] };
    playItemEffectSound(kind);
    setItemActionEffect(nextEffect);
    setItemActionProgress(0);

    const sequence = [...nextEffect.petAnim];
    let stepIndex = 0;
    const runPetReaction = () => {
      if (stepIndex >= sequence.length) {
        setActionAnim(null);
        return;
      }
      const currentStep = sequence[stepIndex];
      setActionAnim(currentStep.clip);
      stepIndex += 1;
      setTimeout(runPetReaction, currentStep.delay);
    };
    runPetReaction();

    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / nextEffect.duration, 1);
      setItemActionProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }

      setTimeout(() => {
        setItemActionEffect(null);
        setItemActionProgress(0);
        setActionAnim(null);
      }, 180);
    };

    requestAnimationFrame(tick);
  }, [playItemEffectSound]);

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
  const [newInventoryCount, setNewInventoryCount] = useState(0);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [isShopOpen, setIsShopOpen] = useState(false);

  const [newsList, setNewsList] = useState<any[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [isNewsOpen, setIsNewsOpen] = useState(false);

  const [isFoodMenuOpen, setIsFoodMenuOpen] = useState(false);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [isCareMenuOpen, setIsCareMenuOpen] = useState(false);
  const [isWalkPromptOpen, setIsWalkPromptOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

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

  const updateActionAnim = (animName: string | null) => {
    if (isDebugMode()) {
      console.log(`[Animation] Changing to: ${animName || '(none)'} at ${new Date().toLocaleTimeString()}`);
    }
    setActionAnim(animName);
  };
  const [itemActionEffect, setItemActionEffect] = useState<ItemActionEffect | null>(null);
  const [itemActionProgress, setItemActionProgress] = useState(0);
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
  
  // モーダル表示用Stateの追加と、本日の訪問履歴管理
  const [isSpotFoundModalOpen, setIsSpotFoundModalOpen] = useState(false);
  const [lastDismissedSpotId, setLastDismissedSpotId] = useState<string | null>(null);
  const [visitedSpotsToday, setVisitedSpotsToday] = useState<Set<string>>(new Set());

  const [mapZoomLevel, setMapZoomLevel] = useState(3);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [sceneKey, setSceneKey] = useState(0);
  const arViewportRef = useRef<HTMLDivElement>(null);
  const appRootRef = useRef<HTMLDivElement>(null);

  const isSleeping = sleepingUntil ? new Date(sleepingUntil) > new Date() : false;

  const allMapSpots = useMemo(() => {
    const parsedCustomSpots = customSpots.filter(cs => cs.latitude != null && cs.longitude != null).map(cs => ({
      ...cs,
      latitude: Number(cs.latitude),
      longitude: Number(cs.longitude),
      isCustom: true,
      radius_meters: 50,
      bonus_points: 0
    }));
    return [...landmarks, ...parsedCustomSpots];
  }, [landmarks, customSpots]);

  useEffect(() => {
    const setAppHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);
    window.visualViewport?.addEventListener('resize', setAppHeight);
    window.visualViewport?.addEventListener('scroll', setAppHeight);
    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
      window.visualViewport?.removeEventListener('resize', setAppHeight);
      window.visualViewport?.removeEventListener('scroll', setAppHeight);
    };
  }, []);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);

  const lastEncounterTime = useRef(0);

  const targetDistanceToHatch = 7500;
  const targetFeedCount = 10;

  const stepCount = Math.floor(walkDistance / 0.75);

  const releaseCameraResources = useCallback(() => {
    try {
      const viewport = arViewportRef.current;
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach(video => {
        try {
          if (video.srcObject) {
            const tracks = (video.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
          }
          video.pause?.();
          video.remove();
        } catch {}
      });
      if (viewport) {
        const scenes = viewport.querySelectorAll('a-scene') as NodeListOf<any>;
        scenes.forEach(scene => {
          try {
            scene.systems?.['mindar-image-system']?.stop?.();
            scene.renderer?.dispose?.();
          } catch {}
        });
      }
    } catch {}
  }, []);

  const normalizeArLayers = useCallback(() => {
    try {
      const viewport = arViewportRef.current;
      if (!viewport) return;
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
        el.style.objectPosition = 'center';
        el.style.zIndex = '0';
        el.style.pointerEvents = 'none';
        el.style.transform = 'none';
        el.style.margin = '0';
        el.style.top = '0';
        el.style.left = '0';
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
        el.style.transform = 'none';
        el.style.margin = '0';
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
        el.style.transform = 'none';
        el.style.margin = '0';
      });
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      scenes.forEach(scene => {
        try {
          scene.resize?.();
          const isMindArScene = scene.hasAttribute?.('mindar-image');
          if (!isMindArScene) {
            scene.renderer?.setSize?.(width, height, false);
            if (scene.camera) {
              scene.camera.aspect = width / height;
              scene.camera.updateProjectionMatrix?.();
            }
          }
        } catch {}
      });
    } catch {}
  }, []);

  const suppressStrayOverlays = useCallback(() => {
    try {
      const root = appRootRef.current;
      if (!root || typeof document === 'undefined' || !document.body) return;
      Array.from(document.body.children).forEach(child => {
        if (child === root || child.contains(root)) return;
        const tag = child.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META' || tag === 'NOSCRIPT' || tag === 'VIDEO' || tag === 'TITLE') {
          return;
        }
        const el = child as HTMLElement;
        if (el.dataset.strayOverlaySuppressed === 'true') return;
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute('aria-hidden', 'true');
        el.dataset.strayOverlaySuppressed = 'true';
      });
    } catch {}
  }, []);

  useEffect(() => {
    suppressStrayOverlays();
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    const bodyObserver = new MutationObserver(() => {
      suppressStrayOverlays();
    });
    bodyObserver.observe(document.body, { childList: true });
    return () => bodyObserver.disconnect();
  }, [suppressStrayOverlays]);

  const closeAllMenus = () => {
    setIsSpotMapOpen(false);
    setIsNewsOpen(false);
    setIsInventoryOpen(false);
    setIsShopOpen(false);
    setIsStatusModalOpen(false);
    setIsDebugModalOpen(false);
    setIsFoodMenuOpen(false);
    setIsSleepMenuOpen(false);
    setIsCareMenuOpen(false);
    setIsWalkPromptOpen(false);
    setIsHelpModalOpen(false);
    setIsEncyclopediaOpen(false);
    setIsSettingsOpen(false);
  };

  const handleModeChange = (mode: 'mindar' | 'gps' | 'report') => {
    playSound('tap');
    if (mode === viewMode) return;
    const isCrossingArEngines = (mode === 'gps' && viewMode === 'mindar') || (mode === 'mindar' && viewMode === 'gps');
    if (isCrossingArEngines && arjsLoaded) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('mode', mode);
      if (tagIdParam) nextParams.set('tag_id', tagIdParam);
      window.location.href = `${window.location.pathname}?${nextParams.toString()}`;
      return;
    }
    closeAllMenus();
    setIsSwitchingMode(true);
    setCameraReady(mode === 'report');
    setViewMode(mode);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('mode', mode);
    if (tagIdParam) nextParams.set('tag_id', tagIdParam);
    const query = nextParams.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', nextUrl);
    window.setTimeout(() => {
      releaseCameraResources();
      setSceneKey(prev => prev + 1);
      setIsSwitchingMode(false);
      normalizeArLayers();
    }, 600);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!rawModeParam) return;
    const isValid = rawModeParam === 'mindar' || rawModeParam === 'gps' || rawModeParam === 'report';
    if (isValid) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('mode', 'mindar');
    if (tagIdParam) nextParams.set('tag_id', tagIdParam);
    const query = nextParams.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [rawModeParam, searchParams, tagIdParam]);

  useEffect(() => {
    return () => {
      releaseCameraResources();
    };
  }, [releaseCameraResources]);

  useEffect(() => {
    if (viewMode === 'report') return;
    normalizeArLayers();
    let count = 0;
    const timer = window.setInterval(() => {
      normalizeArLayers();
      count += 1;
      if (count >= 16) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [viewMode, sceneKey, isSwitchingMode, normalizeArLayers]);

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

  useEffect(() => {
    if (!isSwitchingMode) return;
    const timer = window.setTimeout(() => setIsSwitchingMode(false), 2000);
    return () => window.clearTimeout(timer);
  }, [isSwitchingMode]);

  useEffect(() => {
    if (viewMode === 'report') {
      setCameraReady(true);
      setCameraTrulyReady(true);
      return;
    }
    if (!isClient || isAuthChecking || !isDataLoaded || isSwitchingMode) return;
    if (viewMode === 'mindar' && !scriptsReadyForMindar) return;
    if (viewMode === 'gps' && !scriptsReadyForGps) return;
    setCameraTrulyReady(false);
    let tries = 0;
    const maxTries = 75; 
    const timer = window.setInterval(() => {
      const viewport = arViewportRef.current;
      const videos = Array.from(viewport?.querySelectorAll('video') ?? []) as HTMLVideoElement[];
      const ready = videos.some(v => v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0);
      if (ready) {
        setCameraReady(true);
        setCameraTrulyReady(true);
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
  }, [viewMode, isClient, isAuthChecking, isDataLoaded, isSwitchingMode, sceneKey, scriptsReadyForMindar, scriptsReadyForGps]);

  const retryCamera = useCallback(() => {
    playSound('tap');
    setIsSwitchingMode(true);
    setCameraReady(false);
    setCameraTrulyReady(false);
    window.setTimeout(() => {
      releaseCameraResources();
      setSceneKey(prev => prev + 1);
      setIsSwitchingMode(false);
    }, 600);
  }, [playSound, releaseCameraResources]);

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

const todayStr = new Date().toLocaleDateString('sv-SE');
const { error: loginLogError } = await supabase.from('user_login_logs').upsert(
  {
    user_id: userId,
    login_date: todayStr,
    login_timestamp: new Date().toISOString(),
  },
  { onConflict: 'user_id, login_date' }
);
if (loginLogError) {
  console.error('🔴 user_login_logs 記録エラー:', loginLogError);
}

const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();
        if (!profile || !profile.birth_year) {
          setShowProfileSetup(true);
        } else {
          setInputBirthYear(profile.birth_year.toString());
          setInputGender(profile.gender || '');
          setIsNotificationEnabled(profile.email_notify_feed ?? true);
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
    if (!sessionUserId || !petId || isEgg) return;
    const tryTriggerMindfulness = () => {
      if (showMindfulness || isSleeping || petCondition !== 'healthy') return;
      if (Math.random() < 0.3) {
        setShowMindfulness(true);
        setMindPhase('intro');
      }
    };
    if (!hasTriggeredMindfulness.current) {
      hasTriggeredMindfulness.current = true;
      tryTriggerMindfulness();
    }
    const interval = window.setInterval(tryTriggerMindfulness, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [sessionUserId, petId, isEgg, isSleeping, petCondition, showMindfulness]);

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
      await supabase.from('user_inventory').update({ quantity: inventoryItem.quantity + 1 }).eq('id', inventoryItem.id);
    } else {
      await supabase.from('user_inventory').insert({ user_id: userId, item_id: item.id, quantity: 1 });
    }

    const { data: inv } = await supabase
      .from('user_inventory')
      .select('id, quantity, item_masters:item_id(*)')
      .eq('user_id', userId)
      .gt('quantity', 0);
    if (inv) setInventory(inv);
  };

  const checkLoginBonus = async (userId: string, profile: any) => {
    const today = new Date().toLocaleDateString('sv-SE');
    const lastLoginDate = profile.last_login_date;

    if (!lastLoginDate || lastLoginDate === today) {
      return;
    }

    const lastLogin = new Date(`${lastLoginDate}T00:00:00`);
    const todayDate = new Date(`${today}T00:00:00`);
    const diffDays = Math.round((todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

    let currentLoginDays = profile.login_days || 0;
    if (diffDays === 1) {
      currentLoginDays = currentLoginDays >= 7 ? 1 : currentLoginDays + 1;
    } else {
      currentLoginDays = 1;
    }

    const gotBonus = currentLoginDays === 7;
    if (gotBonus) {
      await grantLoginBonusItem(userId);
    }

    await supabase.from('user_profiles').update({ last_login_date: today, login_days: currentLoginDays }).eq('id', userId);
    setLoginBonusState({ days: currentLoginDays, gotBonus, showModal: true });
    playSound('levelup');
  };

  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  const fetchGameData = useCallback(async () => {
    if (!sessionUserId) return;
    setDataLoadError(null);
    try {
      const { data: items } = await supabase.from('item_masters').select('*').order('id', { ascending: false });
      if (items) setShopItems(items);

      // 本日の訪問履歴を取得
      const today = new Date().toLocaleDateString('sv-SE');
      const { data: visitsToday } = await supabase
        .from('landmark_visits')
        .select('landmark_id')
        .eq('user_id', sessionUserId)
        .eq('visited_date', today);
      if (visitsToday) {
        setVisitedSpotsToday(new Set(visitsToday.map((v: any) => String(v.landmark_id))));
      }

// マップには管理画面から登録したスポットも表示するため、landmarks と landmark_masters の両方を取得して統合する
// ※ landmark_masters は施設タイプのマスター定義のみを持ち、緯度経度は landmarks 側にのみ存在する
// マップ表示用のスポットは全て landmarks テーブルの実体行から取得する
// （landmark_masters は施設タイプ等のテンプレート定義のみで座標は持たない）
const { data: spots, error: spotsError } = await supabase
  .from('landmarks')
  .select('*');
if (spotsError) {
  console.error('🔴 landmarks 取得エラー:', spotsError);
}

let combinedLandmarks: any[] = [];

if (spots) {
  combinedLandmarks = spots
    .map((spot: any) => {
      const lat = Number(spot.latitude);
      const lng = Number(spot.longitude);
      const radius = Number(spot.radius_meters);
      const bonus = Number(spot.bonus_points);
      return {
        ...spot,
        id: String(spot.id),
        latitude: lat,
        longitude: lng,
        radius_meters: Number.isFinite(radius) ? radius : 50,
        bonus_points: Number.isFinite(bonus) ? bonus : 10,
      };
    })
    // 緯度経度が不正なものだけ除外（is_public や日時での絞り込みは今回は入れない）
    .filter((spot: any) => Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude));
}

if (isDebugMode()) {
console.log('[スポット取得結果]', {
  rawCount: spots?.length ?? 0,
  visibleCount: combinedLandmarks.length,
  spotsError,
});
}

setLandmarks(combinedLandmarks);

      const { data: news } = await supabase.from('announcements').select('*').eq('is_active', true).order('published_at', { ascending: false });
      if (news) setNewsList(news);

      const { data: notifications } = await supabase.from('user_notifications').select('*').eq('user_id', sessionUserId).order('created_at', { ascending: false }).limit(20);
      if (notifications) setUserNotifications(notifications);

      const { data: pm } = await supabase.from('pet_masters').select('*').order('id', { ascending: true });
      if (pm) setAllPetMasters(pm);

      const { data: up } = await supabase.from('pets').select('pet_master_id, is_deceased').eq('owner_id', sessionUserId).not('pet_master_id', 'is', null);
      if (up) {
        const acquired = new Set<string>();
        const hof = new Set<string>();
        up.forEach((p: any) => {
          if (p.pet_master_id) acquired.add(p.pet_master_id);
          if (p.pet_master_id && p.is_deceased) hof.add(p.pet_master_id);
        });
        setAcquiredPetIds(acquired);
        setHallOfFamePetIds(hof);
      }

      const { data: cs } = await supabase.from('custom_spots').select('*').eq('user_id', sessionUserId).order('created_at', { ascending: false });
      if (cs) setCustomSpots(cs);

      setGameOverNotice(null);
      setGameOverHandled(false);

      const { data: pet, error: petFetchError } = await supabase
        .from('pets')
        .select(`
          id, owner_id, affection_level, sleeping_until, last_fed_at, 
          is_egg, walk_distance_m, level, exp, custom_name, birthday, condition_status, generation, is_deceased, egg_master_id, pet_master_id
        `)
        .eq('owner_id', sessionUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (petFetchError) {
        console.error('ペット情報の取得に失敗しました:', petFetchError);
        throw petFetchError;
      }

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
            setEggModelUrl('/models/eggs/egg.glb');
          }
        } else {
          setEggModelUrl('/models/eggs/egg.glb');
        }

        if (pet.pet_master_id) {
          const { data: petMasterData, error: petMasterFetchError } = await supabase
            .from('pet_masters')
            .select('name, model_url, model_url_v2, model_url_v3, rarity, egg_type')
            .eq('id', pet.pet_master_id)
            .maybeSingle();

          if (petMasterFetchError) {
            console.error('ペットマスターの取得に失敗しました:', petMasterFetchError);
          }

          if (petMasterData) {
            const rarityPm = petMasterData.rarity || '?';
            const fallbackBase = `/models/pet/${rarityPm}`;

            setPetModelUrlV1(petMasterData.model_url || `${fallbackBase}/v1.glb`);
            setPetModelUrlV2(petMasterData.model_url_v2 || `${fallbackBase}/v2.glb`);
            setPetModelUrlV3(petMasterData.model_url_v3 || `${fallbackBase}/v3.glb`);
            setPetMasterName(petMasterData.name || '不明');
            setPetRarity(rarityPm);
          }

          const { data: attrRels } = await supabase
            .from('pet_master_attributes')
            .select('attribute_id, attributes:attribute_id(id, name, description)')
            .eq('pet_master_id', pet.pet_master_id);

          if (attrRels && attrRels.length > 0) {
            const attrs = attrRels.map((rel: any) => rel.attributes).filter(Boolean);
            setPetAttributes(attrs);

            const attrIds = attrs.map((a: any) => a.id);

            const { data: weaknesses } = await supabase
              .from('attribute_weaknesses')
              .select('*, weak_against:weak_against_id(id, name, description)')
              .in('attribute_id', attrIds);

            if (weaknesses && weaknesses.length > 0) {
              setPetAttributeWeaknesses(weaknesses);
            } else {
              setPetAttributeWeaknesses([]);
            }

            const { data: affinities } = await supabase
              .from('attribute_item_affinities')
              .select('*')
              .in('attribute_id', attrIds);

            if (affinities) setPetAffinities(affinities);
            else setPetAffinities([]);
          } else {
            setPetAttributes([]);
            setPetAttributeWeaknesses([]);
            setPetAffinities([]);
          }
        } else {
          setPetAttributes([]);
          setPetAttributeWeaknesses([]);
          setPetAffinities([]);
        }

        const { data: inv } = await supabase
          .from('user_inventory')
          .select('id, quantity, item_masters:item_id(*)')
          .eq('user_id', sessionUserId)
          .gt('quantity', 0);
        if (inv) setInventory(inv);

        const { count: feedLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'feed');
        if (feedLogCount !== null) setFeedCount(feedLogCount);

        const { count: eventLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'event');
        if (eventLogCount !== null) setEventCount(eventLogCount);

        const { count: mindCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'mindfulness');
        if (mindCount !== null) setMindfulnessLogCount(mindCount);

        const { count: landmarkCount } = await supabase.from('landmark_visits').select('id', { count: 'exact', head: true }).eq('user_id', sessionUserId);
        if (landmarkCount !== null) setLandmarkVisitCount(landmarkCount);

      } else {
        setIsEggUnregistered(true);
        setIsEgg(true);
        setEggModelUrl('/models/eggs/egg.glb');
        setPetAttributes([]);
        setPetAffinities([]);
      }
    } catch (error: any) {
      console.error('fetchGameData error', error);
      setDataLoadError(error?.message || 'データの取得に失敗しました。通信状態を確認して再試行してください。');
    } finally {
      setIsDataLoaded(true);
    }
  }, [sessionUserId, supabase]);

  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  const handleAddCustomSpot = async () => {
    if (!sessionUserId || !newSpotName || !newSpotFile) return;
    setIsUploadingSpot(true);
    try {
      let currentLat = location?.lat;
      let currentLng = location?.lng;

      if (!currentLat || !currentLng) {
        if (!navigator.geolocation) {
          throw new Error('お使いの端末はGPSに対応していません。');
        }
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              currentLat = pos.coords.latitude;
              currentLng = pos.coords.longitude;
              resolve();
            },
            () => reject(new Error('GPSの取得に失敗しました。位置情報の権限を許可してください。')),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      }

      const fileExt = newSpotFile.name.split('.').pop();
      const fileName = `${sessionUserId}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('spot_images').upload(fileName, newSpotFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('spot_images').getPublicUrl(fileName);
      const imageUrl = publicUrlData.publicUrl;

      const { data: newSpot, error: insertError } = await supabase.from('custom_spots').insert({
        user_id: sessionUserId,
        name: newSpotName,
        image_url: imageUrl,
        latitude: currentLat ? Number(currentLat) : null, 
        longitude: currentLng ? Number(currentLng) : null 
      }).select('*').single();

      if (insertError) throw insertError;

      setCustomSpots(prev => [newSpot, ...prev]);
      setNewSpotName('');
      setNewSpotFile(null);
      alert('新しいスポットを図鑑に記録しました！');
      playSound('levelup');
    } catch (err: any) {
      console.error(err);
      alert('スポットの保存に失敗しました: ' + err.message);
    } finally {
      setIsUploadingSpot(false);
    }
  };

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
          is_deceased: true,
        })
        .eq('id', targetPetId);
      setTimeout(() => {
        setRainbowPhase(2);
      }, 4000);
    } catch (error) {
      console.error('虹の橋の処理に失敗しました', error);
    }
  };

  const closeRainbowBridge = async () => {
    setShowRainbowBridge(false);
    if (sessionUserId) {
      await handleCreateEgg();
    } else {
      window.location.reload();
    }
  };

  const getCurrentModelUrl = () => {
    if (isEgg || isEggUnregistered) return eggModelUrl;
    if (level >= 50 && petModelUrlV3) return petModelUrlV3;
    if (level >= 30 && petModelUrlV2) return petModelUrlV2;
    return petModelUrlV1;
  };
  const activeModelUrl = getCurrentModelUrl();
  const displayName = customName || petMasterName || '名無し';

  const getLevelRequirement = (levelNumber: number) => ({
    distance: targetDistanceToHatch * levelNumber,
    feed: targetFeedCount * levelNumber,
  });

  const hatchProgress = {
    distance: Math.min(1, walkDistance / targetDistanceToHatch),
    feed: Math.min(1, feedCount / targetFeedCount),
  };
  const isHatchReady = !isEggUnregistered && isEgg && petId && hatchProgress.distance >= 1 && hatchProgress.feed >= 1;
  const nextLevelRequirements = getLevelRequirement(level);
  const isNextLevelReady = !isEgg && petId && walkDistance >= nextLevelRequirements.distance && feedCount >= nextLevelRequirements.feed;
  const expNeededForNextLevel = level * 500; 

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
      if (isSleeping) {
        calculatedHunger = 100;
      }
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
    if (isSleeping) return; 
    const now = Date.now();
    const lastFedTime = new Date(lastFedAt).getTime();
    const hoursPassed = (now - lastFedTime) / (1000 * 60 * 60);
    if (hoursPassed >= 24) {
      void resetPetToEgg('体力が尽きて24時間が経過したため');
    }
  }, [petId, lastFedAt, isEgg, gameOverHandled, isSleeping]);

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

  const showHatchEffect = (rarity: string, petName: string) => {
    return new Promise<void>(resolve => {
      if (!isEffectEnabledRef.current) {
        resolve();
        return;
      }
      const multiplier = rarity === 'UR' ? 8 : rarity === 'SR' ? 4 : rarity === 'R' ? 2 : 1;
      const base = 30;
      const count = Math.min(300, Math.floor(base * multiplier));
      const colors = {
        N: ['#E5E7EB', '#F9FAFB'],
        R: ['#FDE68A', '#FCA5A5', '#FBCFE8'],
        SR: ['#C7A3FF', '#FDE68A', '#FECACA', '#A7F3D0', '#FFFFFF'],
        UR: ['#FFD700', '#FF73FA', '#7CF0FF', '#FF9F1C', '#FFFFFF', '#00FF00'],
      } as Record<string, string[]>;
      const particles = Array.from({ length: count }).map((_, i) => {
        const angle = (Math.random() - 0.5) * Math.PI * 2;
        const distance = 80 + Math.random() * (rarity === 'UR' ? 500 : rarity === 'SR' ? 350 : rarity === 'R' ? 250 : 150);
        return {
          id: `${Date.now()}_${i}`,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - Math.random() * 100,
          color: (colors[rarity as keyof typeof colors] || colors.N)[Math.floor(Math.random() * (colors[rarity as keyof typeof colors] || colors.N).length)],
          size: 6 + Math.random() * (rarity === 'UR' ? 15 : rarity === 'SR' ? 12 : 8),
          duration: 700 + Math.random() * (rarity === 'UR' ? 2000 : rarity === 'SR' ? 1500 : 800),
        };
      });
      setHatchOverlay({ active: true, particles, rarity, petName, showConfirm: false, resolve });
      setTimeout(() => {
        setHatchOverlay(prev => (prev ? { ...prev, particles: prev.particles.map(p => ({ ...p, launched: true })) } : prev));
      }, 1000);
      const maxDuration = Math.max(...particles.map(p => p.duration)) + 300;
      setTimeout(() => {
        setHatchOverlay(prev => prev ? { ...prev, showConfirm: true } : prev);
      }, maxDuration);
    });
  };

  const showLevelUpEffect = (newLevel: number) => {
    return new Promise<void>(resolve => {
      if (!isEffectEnabledRef.current) {
        resolve();
        return;
      }
      const isMilestone = newLevel === 30 || newLevel === 50 || newLevel % 10 === 0 || newLevel === 99;
      const count = isMilestone ? 250 : 50;
      const colors = isMilestone ? ['#FFD700', '#FF73FA', '#7CF0FF', '#FF9F1C', '#FFFFFF'] : ['#60A5FA', '#34D399', '#FBBF24'];
      const particles = Array.from({ length: count }).map((_, i) => {
        const angle = (Math.random() - 0.5) * Math.PI * 2;
        const distance = isMilestone ? 150 + Math.random() * 350 : 80 + Math.random() * 150;
        return {
          id: `lvl_${Date.now()}_${i}`,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - Math.random() * 150,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: isMilestone ? 8 + Math.random() * 15 : 6 + Math.random() * 8,
          duration: isMilestone ? 1000 + Math.random() * 2000 : 700 + Math.random() * 800,
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
    const expNeeded = newLevel * 500;
    const nextRequirements = getLevelRequirement(newLevel);
    if (newExp >= expNeeded) {
      if (walkDistance >= nextRequirements.distance && feedCount >= nextRequirements.feed) {
        newExp -= expNeeded;
        newLevel += 1;
        leveledUp = true;
      } else {
        setExp(newExp);
        await supabase.from('pets').update({ exp: newExp }).eq('id', petId);
        return alert(`🌱 もうすぐレベルアップ！ でもまだ条件が揃っていません。\n必要: 歩行 ${nextRequirements.distance}m / 給餌 ${nextRequirements.feed}回`);
      }
    }
    setExp(newExp);
    setLevel(newLevel);
    await supabase.from('pets').update({ exp: newExp, level: newLevel }).eq('id', petId);
    if (leveledUp) {
      playSound('levelup');
      await showLevelUpEffect(newLevel);
      if (newLevel >= 99) {
        alert('🎉 レベル99到達！おめでとうございます！！');
        triggerRainbowBridge(petId, generation);
        return;
      }
      alert(`🌟 レベルアップ！ Lv.${newLevel} になりました！`);
      if (newLevel === 30 && petModelUrlV2) alert('体が少し大きくなったみたい…！');
      if (newLevel === 50 && petModelUrlV3) alert('姿が大きく変わった…！');
      await triggerRandomSickness();
    }
  };

  const triggerEncounter = async () => {
    if (!sessionUserId) return;
    const now = Date.now();
    if (now - lastEncounterTime.current < 300000) return;
    lastEncounterTime.current = now;
    try {
      const newNotification = {
        user_id: sessionUserId,
        title: 'すれ違い通信',
        content: 'ほかのユーザーとすれ違いました！「ぺたるの香り」を手に入れました。\n下のボタンから受け取ってください。',
      };
      
      const { data: insertedNotif, error } = await supabase
        .from('user_notifications')
        .insert(newNotification)
        .select('*')
        .single();
        
      if (error) throw error;

      setUserNotifications(prev => [insertedNotif, ...prev]);
      alert('📡 すれ違い通信が発生しました！お知らせを確認してください。');
      playSound('item');
    } catch (err) {
      console.error('すれ違い処理エラー', err);
    }
  };

  const handleReceiveEncounterItem = async (notification: any) => {
    if (!sessionUserId) return;
    try {
      let { data: item } = await supabase.from('item_masters').select('*').eq('name', 'ぺたるの香り').maybeSingle();
      if (item) {
        const { data: inventoryItem } = await supabase.from('user_inventory').select('id, quantity').eq('user_id', sessionUserId).eq('item_id', item.id).maybeSingle();
        if (inventoryItem) {
          await supabase.from('user_inventory').update({ quantity: inventoryItem.quantity + 1 }).eq('id', inventoryItem.id);
        } else {
          await supabase.from('user_inventory').insert({ user_id: sessionUserId, item_id: item.id, quantity: 1 });
        }
        
        const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters:item_id(*)').eq('user_id', sessionUserId).gt('quantity', 0);
        if (inv) setInventory(inv);
        
        showItemReward([item], 'すれ違い通信', '📡');
      }
      
      await supabase.from('user_notifications').delete().eq('id', notification.id);
      setUserNotifications(prev => prev.filter(n => n.id !== notification.id));
      
    } catch (err) {
      console.error('アイテム受け取りエラー', err);
      alert('アイテムの受け取りに失敗しました。');
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
    if (viewMode === 'gps' && location && allMapSpots.length > 0) {
      const found = allMapSpots.find(spot => getDistance(location.lat, location.lng, spot.latitude, spot.longitude) <= spot.radius_meters);
      if (found) {
        if (!activeLandmark || activeLandmark.id !== found.id) {
          setActiveLandmark(found);
          if (lastDismissedSpotId !== found.id) {
            setIsSpotFoundModalOpen(true);
            playSound('item');
          }
        }
      } else {
        setActiveLandmark(null);
        setIsSpotFoundModalOpen(false);
        setLastDismissedSpotId(null);
      }
    }
  }, [location, allMapSpots, viewMode, activeLandmark, lastDismissedSpotId, playSound]);

  useEffect(() => {
    if (viewMode !== 'gps') {
      setIsSpotMapOpen(false);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'mindar' || !petId || isEgg || isSleeping || !isDataLoaded) return;

    const handlePetTap = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = customEvent.detail?.id || '';

      if (!/^pet-hitbox-\d+$/.test(id)) return;

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

    window.addEventListener('pet-tapped', handlePetTap);
    return () => window.removeEventListener('pet-tapped', handlePetTap);
  }, [viewMode, petId, supabase, isEgg, isSleeping, petCondition, isDataLoaded]);

  useEffect(() => {
    if (!aframeLoaded || typeof window === 'undefined') return;
    const AFRAME = (window as any).AFRAME;

    if (AFRAME && !AFRAME.components['pet-interact']) {
      AFRAME.registerComponent('pet-interact', {
        init: function () {
          this.el.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('pet-tapped', { detail: { id: this.el.id } }));
          });
        }
      });
    }

    if (AFRAME && !AFRAME.components['mindar-event-listener']) {
      AFRAME.registerComponent('mindar-event-listener', {
        init: function () {
          this.el.addEventListener('targetFound', () => {
            window.dispatchEvent(new CustomEvent('mindar-target-found', { detail: { id: this.el.id } }));
          });
          this.el.addEventListener('targetLost', () => {
            window.dispatchEvent(new CustomEvent('mindar-target-lost', { detail: { id: this.el.id } }));
          });
        }
      });
    }

    if (AFRAME && !AFRAME.components['pet-anim-controller']) {
      AFRAME.registerComponent('pet-anim-controller', {
        schema: {
          clip: { type: 'string', default: '' }
        },
        update: function (oldData: any) {
          if (this.data.clip !== oldData.clip) {
            this.el.removeAttribute('animation');
            this.el.setAttribute('position', '0 0 0');
            this.el.setAttribute('rotation', '0 0 0');
            this.el.setAttribute('scale', '1 1 1');

            const clip = this.data.clip;
            if (!clip) return;

            if (clip === 'Idle') {
              this.el.setAttribute('animation', 'property: position; to: 0 0.5 0; dir: alternate; dur: 1000; loop: true; easing: easeInOutSine');
            } else if (clip === 'Happy') {
              this.el.setAttribute('animation', 'property: rotation; to: 0 1080 0; dur: 1000; loop: true; easing: linear');
            } else if (clip === 'Jump') {
              this.el.setAttribute('animation', 'property: position; to: 0 2.5 0; dir: alternate; dur: 200; loop: true; easing: easeOutQuad');
            } else if (clip === 'Fly') {
              this.el.setAttribute('animation', 'property: position; to: 0 4.0 0; dir: alternate; dur: 1000; loop: true; easing: easeInOutSine');
            } else if (clip === 'Sleep') {
              this.el.setAttribute('animation', 'property: scale; to: 1.4 0.6 1.4; dir: alternate; dur: 1500; loop: true; easing: easeInOutSine');
            } else if (clip === 'Sad') {
              this.el.setAttribute('animation', 'property: rotation; to: 70 0 0; dir: alternate; dur: 1000; loop: true; easing: easeInOutSine');
            } else if (clip === 'Angry') {
              this.el.setAttribute('animation', 'property: position; to: 0.4 0 0; dir: alternate; dur: 30; loop: true; easing: linear');
            }
          }
        }
      });
    }
  }, [aframeLoaded]);

  useEffect(() => {
    if (viewMode !== 'mindar') return;

    const onFound = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = customEvent.detail?.id || '';
      const match = /^marker-target-(\d+)$/.exec(id);
      if (match) setDetectedTargetIndex(Number(match[1]));
    };

    const onLost = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = customEvent.detail?.id || '';
      const match = /^marker-target-(\d+)$/.exec(id);
      if (match) {
        const idx = Number(match[1]);
        setDetectedTargetIndex(prev => (prev === idx ? null : prev));
      }
    };

    window.addEventListener('mindar-target-found', onFound);
    window.addEventListener('mindar-target-lost', onLost);
    return () => {
      window.removeEventListener('mindar-target-found', onFound);
      window.removeEventListener('mindar-target-lost', onLost);
    };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'mindar' || !(aframeLoaded && extrasLoaded && mindarLoaded) || isSwitchingMode) return;
    const cleanups: Array<() => void> = [];
    const assetEl = document.querySelector('#pet-asset');
    if (assetEl) {
      const onAssetError = (e: any) => console.error('🔴 モデルasset読み込みエラー(#pet-asset):', activeModelUrl, e?.detail || e);
      assetEl.addEventListener('error', onAssetError);
      cleanups.push(() => assetEl.removeEventListener('error', onAssetError));
    }
    Array.from({ length: MARKER_COUNT }).forEach((_, i) => {
      const el = document.querySelector(`#pet-model-${i}`);
      if (!el) return;
      const onModelError = (e: any) => console.error(`🔴 pet-model-${i} の読み込みに失敗:`, activeModelUrl, e?.detail || e);
      const onModelLoaded = () => console.log(`✅ pet-model-${i} 読み込み成功:`, activeModelUrl);
      el.addEventListener('model-error', onModelError);
      el.addEventListener('model-loaded', onModelLoaded);
      cleanups.push(() => {
        el.removeEventListener('model-error', onModelError);
        el.removeEventListener('model-loaded', onModelLoaded);
      });
    });
    return () => cleanups.forEach(fn => fn());
  }, [viewMode, aframeLoaded, extrasLoaded, mindarLoaded, isSwitchingMode, sceneKey, activeModelUrl]);

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
      setPetAttributes([]);
      setPetAffinities([]);

      setEggModelUrl(selectedEgg.model_url || '/models/eggs/egg.glb');
      setSceneKey(prev => prev + 1);

      playSound('item');
      alert(`不思議な卵を発見した！\nさんぽ、給餌の条件をこなして孵化させよう！`);
      setNamingInput('');
      setShowNamingScreen(true);
    } catch (err: any) {
      console.error(err);
      alert(`エラーが発生しました: ${err.message}`);
    }
  };

  const handleHatchEgg = async (force = false, forceMasterId?: string) => {
    if (!petId) return;
    if (!isHatchReady && !force) {
      return alert('まだ孵化条件が揃っていません。歩数・給餌の条件を全て満たしてから試してください。');
    }
    try {
      const { data: petMasters } = await supabase.from('pet_masters').select('*');
      if (!petMasters || petMasters.length === 0) {
        return alert('ペットのマスターデータが見つかりません。管理画面からペットを登録してください。');
      }

      let selectedMaster = petMasters[Math.floor(Math.random() * petMasters.length)];
      if (forceMasterId) {
        const found = petMasters.find(p => String(p.id) === String(forceMasterId));
        if (found) selectedMaster = found;
      }

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

      const { data: attrRels } = await supabase
        .from('pet_master_attributes')
        .select('attribute_id, attributes:attribute_id(id, name, description)')
        .eq('pet_master_id', selectedMaster.id);

      if (attrRels && attrRels.length > 0) {
        const attrs = attrRels.map((rel: any) => rel.attributes).filter(Boolean);
        setPetAttributes(attrs);
        const attrIds = attrs.map((a: any) => a.id);

        const { data: weaknesses } = await supabase
          .from('attribute_weaknesses')
          .select('*, weak_against:weak_against_id(id, name, description)')
          .in('attribute_id', attrIds);

        if (weaknesses && weaknesses.length > 0) {
          setPetAttributeWeaknesses(weaknesses);
        } else {
          setPetAttributeWeaknesses([]);
        }

        const { data: affinities } = await supabase.from('attribute_item_affinities').select('*').in('attribute_id', attrIds);
        if (affinities) setPetAffinities(affinities);
      } else {
        setPetAttributeWeaknesses([]);
        setPetAttributes([]);
        setPetAffinities([]);
      }

      playSound('hatch');
      await showHatchEffect(rarityRes, selectedMaster.name || '不明');

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

        setAcquiredPetIds(prev => {
          const next = new Set(prev);
          next.add(selectedMaster.id);
          return next;
        });

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

  const handleUseItem = async (invItem: any) => {
    if (!petId) return;

    if (viewMode !== 'mindar' || detectedTargetIndex === null) {
      playSound('error');
      alert('ペットをARで表示している時だけアイテムを使えます。カメラをマーカーに向けてペットを呼び出してね！');
      return;
    }

    if (isSleeping) {
      playSound('error');
      alert('ペットは眠っています。起きてからアイテムを使ってね。');
      return;
    }

    const item = invItem.item_masters;
    if (!item) return;

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

    let multiplier = 1.0;
    petAffinities.forEach(af => {
      if (af.item_id === item.id) {
        if (af.affinity_type === 'enhance' || af.affinity_type === 'good') multiplier *= 1.5;
        if (af.affinity_type === 'weakness' || af.affinity_type === 'bad') multiplier *= 0.5;
      }
    });

    const finalEffect = Math.max(1, Math.floor((item.effect_value || 0) * multiplier));
    let affinityMessage = '';
    if (multiplier > 1.0) affinityMessage = '\n✨ 属性相性バツグン！効果がアップした！';
    else if (multiplier < 1.0) affinityMessage = '\n💦 苦手なアイテムだったみたい…効果が下がった。';

    try {
      const nextQuantity = invItem.quantity - 1;

      if (nextQuantity <= 0) {
        const { error } = await supabase.from('user_inventory').delete().eq('id', invItem.id);
        if (error) throw error;
        setInventory(prev => prev.filter(i => i.id !== invItem.id));
      } else {
        const { error } = await supabase.from('user_inventory').update({ quantity: nextQuantity }).eq('id', invItem.id);
        if (error) throw error;
        setInventory(prev => prev.map(i => (i.id === invItem.id ? { ...i, quantity: nextQuantity } : i)).filter(i => i.quantity > 0));
      }

      setIsInventoryOpen(false);
      setIsFoodMenuOpen(false);
      setIsSleepMenuOpen(false);
      playSound('item');
    } catch (error) {
      console.error('アイテム使用エラー:', error);
      alert('アイテムを使えませんでした。通信状態を確認して、もう一度お試しください。');
      return;
    }

    if (item.item_type === 'food') {
      const newAffection = affection + finalEffect;
      const now = new Date().toISOString();
      setAffection(newAffection);
      setLastFedAt(now);
      setHungerPercent(100);
      setFeedCount(prev => prev + 1);
      await supabase.from('pets').update({ affection_level: newAffection, last_fed_at: now }).eq('id', petId);
      await supabase.from('activity_logs').insert({ pet_id: petId, action_type: 'feed', points_earned: finalEffect || 20 });
      triggerItemActionEffect('food');
      addExperience(50);
      alert(`✨ ${item.name} をあげました！${affinityMessage}`);
      if (petCondition === 'starving') {
        setPetCondition('healthy');
        setShowConditionSOS(false);
        await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      }
    } else if (item.item_type === 'sleep') {
      const sleepEnd = new Date();
      sleepEnd.setHours(sleepEnd.getHours() + finalEffect);
      setSleepingUntil(sleepEnd.toISOString());

      const newLastFedAt = new Date(lastFedAt || Date.now());
      newLastFedAt.setHours(newLastFedAt.getHours() + finalEffect);
      setLastFedAt(newLastFedAt.toISOString());

      await supabase.from('pets').update({ 
        sleeping_until: sleepEnd.toISOString(),
        last_fed_at: newLastFedAt.toISOString() 
      }).eq('id', petId);
      triggerItemActionEffect('sleep');
      alert(`💤 ${item.name} を使って、ペットは ${finalEffect} 時間眠りにつきました。しばらく面倒を見なくても大丈夫です。${affinityMessage}`);
    } else if (item.item_type === 'medicine') {
      setPetCondition('healthy');
      setShowConditionSOS(false);
      await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      triggerItemActionEffect('medicine');
      alert(`✨ お薬が効いて元気になりました！${affinityMessage}`);
    } else if (item.item_type === 'exp') {
      triggerItemActionEffect('exp');
      addExperience(finalEffect || 100);
      alert(`✨ ${item.name} の香りに包まれて、経験値を獲得しました！${affinityMessage}`);
    } else {
      triggerItemActionEffect('exp');
      addExperience(finalEffect || 10);
      alert(`✨ ${item.name} を使いました！${affinityMessage}`);
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
      const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters:item_id(*)').eq('user_id', sessionUserId).gt('quantity', 0);
      if (inv) setInventory(inv);
      alert('🛍️ 購入しました！「もちもの」から使用できます。');
    } catch (e) {
      alert('エラーが発生しました');
    }
  };

  const handleWalkPrompt = () => {
    playSound('tap');
    closeAllMenus();
    setIsWalkPromptOpen(true);
  };

  const handleOpenCareMenu = () => {
    playSound('tap');
    setIsCareMenuOpen(prev => {
      const next = !prev;
      if (next) {
        setIsSpotMapOpen(false);
        setIsNewsOpen(false);
        setIsInventoryOpen(false);
        setIsShopOpen(false);
        setIsFoodMenuOpen(false);
        setIsSleepMenuOpen(false);
        setIsWalkPromptOpen(false);
        setIsEncyclopediaOpen(false);
        setIsSettingsOpen(false);
      }
      return next;
    });
  };

  const handleOpenFoodMenu = () => {
    playSound('tap');
    setIsCareMenuOpen(false);
    setIsFoodMenuOpen(true);
  };

  const handleOpenSleepMenu = () => {
    playSound('tap');
    setIsCareMenuOpen(false);
    setIsSleepMenuOpen(true);
  };

  const getFacilityType = (name: string) => {
    if (name.includes('ご飯') || name.includes('レストラン') || name.includes('カフェ')) return 'restaurant';
    if (name.includes('病院') || name.includes('クリニック') || name.includes('ドクター')) return 'hospital';
    if (name.includes('ホテル') || name.includes('宿')) return 'hotel';
    return 'normal';
  };

  const grantRandomItems = async (itemType: string | null, count: number) => {
    if (!sessionUserId) return [];
    let query = supabase.from('item_masters').select('*');
    if (itemType) query = query.eq('item_type', itemType);
    const { data: candidates } = await query;
    if (!candidates || candidates.length === 0) return [];

    const granted: any[] = [];
    for (let i = 0; i < count; i++) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      granted.push(picked);

      const { data: existingItem } = await supabase
        .from('user_inventory')
        .select('id, quantity')
        .eq('user_id', sessionUserId)
        .eq('item_id', picked.id)
        .maybeSingle();

      if (existingItem) {
        await supabase.from('user_inventory').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
      } else {
        await supabase.from('user_inventory').insert({ user_id: sessionUserId, item_id: picked.id, quantity: 1 });
      }
    }

    const { data: inv } = await supabase
      .from('user_inventory')
      .select('id, quantity, item_masters:item_id(*)')
      .eq('user_id', sessionUserId)
      .gt('quantity', 0);
    if (inv) setInventory(inv);

    return granted;
  };

  const showItemReward = (items: any[], facilityName: string, facilityIcon: string) => {
    if (!items || items.length === 0) return;
    setNewInventoryCount(prev => prev + items.length);
    playSound('item');
    setItemRewardOverlay({ active: true, items, facilityName, facilityIcon });
  };

  const handleCheckIn = async () => {
    if (!activeLandmark || !petId || !sessionUserId) return;
    const today = new Date().toLocaleDateString('sv-SE');
    const master = activeLandmark.landmark_masters;
    const facilityType = activeLandmark.isCustom ? 'custom' : (master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(activeLandmark.name));

    if (petCondition === 'starving' && facilityType !== 'restaurant') {
      return alert('お腹が減りすぎて動けません…まずはマップから【ご飯屋さん】を探してチェックインしましょう！');
    }
    if (petCondition === 'sick' && facilityType !== 'hospital') {
      return alert('体調が優れないようです…まずはマップから【ドクター (病院)】を探して診てもらいましょう！');
    }

    if (visitedSpotsToday.has(String(activeLandmark.id))) {
       return alert('今日は既に訪問済みです！');
    }

    const { error: visitError } = await supabase.from('landmark_visits').insert({ 
      user_id: sessionUserId, 
      landmark_id: activeLandmark.isMaster ? null : activeLandmark.id, 
      visited_date: today 
    });
    
    if (visitError) {
       console.warn('訪問記録のDB保存に失敗しましたが、ローカル記録として処理します:', visitError);
    }
    
    setVisitedSpotsToday(prev => {
      const next = new Set(prev);
      next.add(String(activeLandmark.id));
      return next;
    });

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

      const grantedFood = await grantRandomItems('food', 3);
      showItemReward(grantedFood, activeLandmark.name, '🍽️');
    } else if (facilityType === 'hospital') {
      alert(`🏥 ${activeLandmark.name} で診察を受けました！\n体調が全回復しました！`);
      if (petCondition === 'sick') {
        setPetCondition('healthy');
        setShowConditionSOS(false);
        await supabase.from('pets').update({ condition_status: 'healthy' }).eq('id', petId);
      }
      setMotivationPercent(100);

      const grantedSleep = await grantRandomItems('sleep', 3);
      showItemReward(grantedSleep, activeLandmark.name, '🏥');
    } else if (facilityType === 'hotel') {
      alert(`🏨 ${activeLandmark.name} でぐっすり休憩！\nごきげんがMAXになりました！`);
      setMotivationPercent(100);

      let grantedHotel = await grantRandomItems('exp', 3);
      if (grantedHotel.length === 0) {
        grantedHotel = await grantRandomItems(null, 3);
      }
      showItemReward(grantedHotel, activeLandmark.name, '🏨');
    } else {
      alert(`🎉 ${activeLandmark.name} で ${activeLandmark.bonus_points} ポイント獲得！\n経験値が大幅にアップ！`);

      const grantedNormal = await grantRandomItems(null, 3);
      showItemReward(grantedNormal, activeLandmark.name, '📍');
    }

    addExperience(100);
  };

  const takeSnapshot = () => {
    playSound('camera');
    const viewport = arViewportRef.current;
    if (!viewport) return alert('AR表示領域が見つかりません。少し待ってから再度お試しください。');
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
          email_notify_feed: isNotificationEnabled,
          email_notify_news: isNotificationEnabled,
          last_login_date: today,
          login_days: 1,
        },
        { onConflict: 'id' },
      );
      if (error) throw error;

      setShowProfileSetup(false);
      alert('プロフィールを設定しました！');
      setLoginBonusState({ days: 1, gotBonus: false, showModal: true });
      playSound('levelup');
      router.refresh();
    } catch (err: any) {
      console.error('プロフィール保存エラー', err);
      alert(err?.message || 'エラーが発生しました。');
    } finally {
      setIsSetupSubmitting(false);
    }
  };

  const handleSettingsSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;
    const birthYear = parseInt(inputBirthYear, 10);
    if (Number.isNaN(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear()) {
      alert('正しい誕生年を入力してください。');
      return;
    }
    setIsSetupSubmitting(true);
    try {
      const { error } = await supabase.from('user_profiles').update({
        birth_year: birthYear,
        gender: inputGender,
        email_notify_feed: isNotificationEnabled,
        email_notify_news: isNotificationEnabled,
      }).eq('id', sessionUserId);
      if (error) throw error;
      alert('設定を保存しました！');
      setIsSettingsOpen(false);
    } catch (err: any) {
      console.error('設定保存エラー', err);
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
      const { error: nameUpdateError, data: updatedRows } = await supabase
        .from('pets')
        .update({ custom_name: namingInput.trim() })
        .eq('id', petId)
        .select('id, custom_name');

      if (nameUpdateError) {
        console.error('名付け保存エラー:', nameUpdateError);
        throw nameUpdateError;
      }
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('保存対象のペットが見つかりませんでした。');
      }

      setCustomName(namingInput.trim());
      setShowNamingScreen(false);
      playSound('levelup');
      if (isEgg) {
        alert(`「${namingInput.trim()}」と名付けました！\n大切に育ててあげよう！`);
      } else {
        alert(`これからよろしくね、${namingInput.trim()}！\n（誕生日は今日の日付で記録されました）`);
      }
    } catch (err: any) {
      console.error('名付けエラー', err);
      alert(`名前の保存に失敗しました。\n詳細: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsNamingSubmitting(false);
    }
  };

  const debugMaxHatchConditions = async () => {
    if (!petId) return;
    setWalkDistance(targetDistanceToHatch);
    setFeedCount(targetFeedCount);
    await supabase.from('pets').update({ walk_distance_m: targetDistanceToHatch }).eq('id', petId);
    alert('孵化条件をMAXにしました');
  };

  if (!isClient || isAuthChecking || (sessionUserId && !isDataLoaded)) {
    return (
      <div className='bg-black w-full h-full flex flex-col items-center justify-center text-white absolute inset-0 z-[9999]'>
        <div className='w-10 h-10 border-4 border-gray-500 border-t-white rounded-full animate-spin mb-4'></div>
        <p className='font-bold'>データ読み込み中...</p>
      </div>
    );
  }

  const currentAnim = actionAnim || currentMood.clip;

  return (
    <div ref={appRootRef} className='relative isolate w-full h-full min-h-0 min-w-0 max-w-full overflow-hidden bg-black text-white'>
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
          touch-action: none;
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
          margin: 0 !important;
          padding: 0 !important;
          top: 0 !important;
          left: 0 !important;
          transform: none !important;
        }
        .ar-camera-viewport video {
          z-index: 0 !important;
          object-fit: cover !important;
        }
        .ar-camera-viewport a-scene,
        .ar-camera-viewport .a-canvas {
          z-index: 1 !important;
          background: transparent !important;
        }
        .ar-camera-viewport.mindar-clickable a-scene,
        .ar-camera-viewport.mindar-clickable .a-canvas {
          pointer-events: auto !important;
        }
        .ar-camera-viewport .a-enter-vr,
        .ar-camera-viewport .mindar-ui-overlay,
        .ar-camera-viewport .arjs-loader {
          display: none !important;
        }
      `}</style>

      <Script src='https://aframe.io/releases/1.5.0/aframe.min.js' strategy='afterInteractive' onLoad={() => setAframeLoaded(true)} />
      {aframeLoaded && (
        <Script src='https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.2.0/dist/aframe-extras.min.js' strategy='afterInteractive' onLoad={() => setExtrasLoaded(true)} />
      )}
      {extrasLoaded && (
        <Script src='https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js' strategy='afterInteractive' onLoad={() => setMindarLoaded(true)} />
      )}
      {gpsEverActivated && extrasLoaded && (
        <Script src='https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js' strategy='afterInteractive' onLoad={() => setArjsLoaded(true)} />
      )}

      <Script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.1.1/model-viewer.min.js" strategy="lazyOnload" />

      {dataLoadError && (
        <div className='absolute inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-6'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4'>
            <div className='text-4xl'>⚠️</div>
            <h2 className='text-lg font-bold text-red-600'>データの取得に失敗しました</h2>
            <p className='text-xs text-gray-600 whitespace-pre-wrap break-words'>{dataLoadError}</p>
            <button onClick={() => fetchGameData()} className='w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform'>
              再試行する
            </button>
          </div>
        </div>
      )}

      {!cameraReady && viewMode !== 'report' && (
        <div className='absolute inset-0 z-10 bg-black/80 flex items-center justify-center pointer-events-none' style={{ pointerEvents: 'none' }}>
          <div className='text-center'>
            <div className='w-10 h-10 border-4 border-gray-500 border-t-white rounded-full animate-spin mx-auto mb-3'></div>
            <p className='font-bold'>カメラを起動しています...</p>
          </div>
        </div>
      )}

      {cameraReady && !cameraTrulyReady && viewMode !== 'report' && !isSwitchingMode && (
        <button
          onClick={retryCamera}
          className='absolute top-20 left-1/2 -translate-x-1/2 z-[180] bg-red-600/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-sm active:scale-95'
        >
          📷 カメラ映像を確認できません。タップして再試行
        </button>
      )}

      {viewMode === 'gps' && !location && !isSwitchingMode && (
        <div className='absolute top-20 left-1/2 -translate-x-1/2 z-[180] bg-black/60 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm'>
          GPSを取得中です... そのまま少しお待ちください
        </div>
      )}

      <button
        onClick={() => setIsDebugModalOpen(true)}
        className='absolute bottom-24 left-4 z-[260] bg-black/50 text-white p-3 rounded-full shadow-2xl active:scale-95 text-xl backdrop-blur-sm border border-gray-600'
        aria-label='デバッグメニュー'
      >
        🐞
      </button>

      {isDebugModalOpen && (
        <div className='absolute inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto relative text-black'>
            <div className='flex justify-between items-center mb-2 border-b pb-2'>
              <h2 className='text-xl font-bold text-red-600'>🐞 デバッグメニュー</h2>
              <button onClick={() => setIsDebugModalOpen(false)} className='text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded'>
                閉じる
              </button>
            </div>

            <div className='space-y-2'>
              <h3 className='font-bold text-sm bg-gray-200 p-1 rounded'>🔧 AR設定（震え対策用）</h3>
              <button onClick={() => setDebugAnimEnabled(!debugAnimEnabled)} className={`w-full font-bold py-2 rounded-lg shadow text-sm ${debugAnimEnabled ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                アニメーション: {debugAnimEnabled ? 'ON' : 'OFF'}
              </button>
              <p className='text-[10px] text-gray-500'>※これをOFFにして震えが止まればアニメーション由来、揺れ続けるならカメラ由来です。</p>
            </div>

            <div className='space-y-2 mt-4'>
              <h3 className='font-bold text-sm bg-gray-200 p-1 rounded'>🥚 卵の検証</h3>
              <button onClick={handleCreateEgg} className='w-full bg-yellow-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                新しい卵を取得する
              </button>
              <button onClick={debugMaxHatchConditions} className='w-full bg-orange-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                孵化条件をすべてMAXにする
              </button>
              <button onClick={() => handleHatchEgg(true)} className='w-full bg-pink-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                条件無視で強制孵化させる (ランダム)
              </button>

              <div className='flex gap-2 mt-2'>
                <select
                  value={debugSelectedPetId}
                  onChange={e => setDebugSelectedPetId(e.target.value)}
                  className='flex-1 border border-gray-300 rounded p-1 text-sm'
                >
                  <option value="">ペットを選択...</option>
                  {allPetMasters.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name} ({pm.rarity || '?'})</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!debugSelectedPetId) return alert('ペットを選択してください');
                    handleHatchEgg(true, debugSelectedPetId);
                  }}
                  className='bg-pink-600 text-white font-bold px-3 rounded shadow text-sm'
                >
                  指定孵化
                </button>
              </div>
            </div>

            <div className='space-y-2 mt-4'>
              <h3 className='font-bold text-sm bg-gray-200 p-1 rounded'>🐕 ペットの検証</h3>
              <button onClick={() => addExperience(1000)} className='w-full bg-blue-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                経験値 +1000 (レベルアップ)
              </button>
              <button onClick={() => addExperience(50000)} className='w-full bg-blue-600 text-white font-bold py-2 rounded-lg shadow text-sm'>
                経験値 +50000 (大幅レベルアップ)
              </button>
              <button onClick={() => { const newDist = walkDistance + 1000; setWalkDistance(newDist); supabase.from('pets').update({ walk_distance_m: newDist }).eq('id', petId); }} className='w-full bg-green-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                歩行距離 +1000m
              </button>
              <button onClick={async () => {
                if (!sessionUserId) return;
                try {
                  const { data: items } = await supabase.from('item_masters').select('*');
                  if (!items || items.length === 0) return alert('アイテムマスターがありません');

                  for (const item of items) {
                    const { data: existing } = await supabase.from('user_inventory').select('id, quantity').eq('user_id', sessionUserId).eq('item_id', item.id).maybeSingle();
                    if (existing) {
                      await supabase.from('user_inventory').update({ quantity: existing.quantity + 99 }).eq('id', existing.id);
                    } else {
                      await supabase.from('user_inventory').insert({ user_id: sessionUserId, item_id: item.id, quantity: 99 });
                    }
                  }
                  const { data: inv } = await supabase.from('user_inventory').select('id, quantity, item_masters:item_id(*)').eq('user_id', sessionUserId).gt('quantity', 0);
                  if (inv) setInventory(inv);
                  alert('📦 すべてのアイテムを99個ずつ追加しました！');
                } catch(e) {
                  console.error(e);
                  alert('アイテム追加エラー');
                }
              }} className='w-full bg-purple-600 text-white font-bold py-2 rounded-lg shadow text-sm'>
                📦 持ち物満タンテスト
              </button>
              <div className='space-y-2 mt-4'>
              <h3 className='font-bold text-sm bg-gray-200 p-1 rounded'>🗺️ GPS・マップの検証</h3>
              <button 
                onClick={() => {
                  if (!location) return alert('GPSが取得されていません。画面上で現在地が取得されるまでお待ちください。');
                  const dummySpot = {
                    id: 'debug-spot-' + Date.now(),
                    name: 'テストスポット(目の前)',
                    latitude: location.lat + 0.0001, 
                    longitude: location.lng,
                    radius_meters: 50,
                    bonus_points: 100,
                    isCustom: false,
                    landmark_masters: { facility_type: 'normal' }
                  };
                  setLandmarks(prev => [dummySpot, ...prev]);
                  alert('現在地のすぐ北(約11m)にテストスポットを配置しました！\nマップとARを確認してください。');
                }} 
                className='w-full bg-teal-600 text-white font-bold py-2 rounded-lg shadow text-sm'
              >
                📍 目の前にテストスポットを生成
              </button>
              
              <button 
  onClick={() => {
    if (!location) return alert('GPSが取得されていません。');
    const distances = allMapSpots
      .map(spot => ({
        name: spot.name,
        dist: Math.round(getDistance(location.lat, location.lng, spot.latitude, spot.longitude))
      }))
      .sort((a, b) => a.dist - b.dist);
    console.log('[スポットまでの距離一覧]', distances);
    alert(distances.map(d => `${d.name}: ${d.dist}m`).join('\n'));
  }}
  className='w-full bg-cyan-600 text-white font-bold py-2 rounded-lg shadow text-sm'
>
  📏 各スポットまでの距離を確認
</button>

              <button 
                onClick={() => {
                  console.log("📍 現在地:", location);
                  console.log("🗺️ 読み込まれた全スポット:", allMapSpots);
                  alert(`現在地: ${location?.lat}, ${location?.lng}\n読み込みスポット件数: ${allMapSpots.length}件\n※詳細はコンソールのログを見てください`);
                }}
                className='w-full bg-gray-600 text-white font-bold py-2 rounded-lg shadow text-sm'
              >
                📋 現在地とスポット件数を確認
              </button>
            </div>
              <button onClick={() => triggerRainbowBridge(petId!, generation)} className='w-full bg-black text-white font-bold py-2 rounded-lg shadow text-sm'>
                🌈 寿命(殿堂入り)テスト
              </button>
              <button onClick={() => showItemReward([{ id: 'debug1', name: 'デバッグご飯', item_type: 'food', image_url: null }, { id: 'debug2', name: 'デバッグ薬', item_type: 'sleep', image_url: null }, { id: 'debug3', name: 'デバッグ香り', item_type: 'exp', image_url: null }], 'デバッグスポット', '🧪')} className='w-full bg-teal-500 text-white font-bold py-2 rounded-lg shadow text-sm'>
                🎁 アイテム獲得演出テスト
              </button>
            </div>

            <div className='space-y-2 mt-4 bg-gray-100 p-3 rounded-lg text-black'>
              <h3 className='font-bold text-sm bg-gray-300 p-1 rounded'>📐 モデル調整（リアルタイム）</h3>
              <div className='text-xs space-y-2'>
                <div>
                  <label className='block'>Scale X: {debugScaleX}</label>
                  <input type="range" min="0.001" max="0.5" step="0.001" value={debugScaleX} onChange={e => setDebugScaleX(parseFloat(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className='block'>Scale Y: {debugScaleY}</label>
                  <input type="range" min="0.001" max="0.5" step="0.001" value={debugScaleY} onChange={e => setDebugScaleY(parseFloat(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className='block'>Scale Z: {debugScaleZ}</label>
                  <input type="range" min="0.001" max="0.5" step="0.001" value={debugScaleZ} onChange={e => setDebugScaleZ(parseFloat(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className='block'>Rot X: {debugRotX}°</label>
                  <input type="range" min="-180" max="180" step="1" value={debugRotX} onChange={e => setDebugRotX(parseFloat(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className='block'>Rot Y: {debugRotY}°</label>
                  <input type="range" min="-180" max="180" step="1" value={debugRotY} onChange={e => setDebugRotY(parseFloat(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className='block'>Rot Z: {debugRotZ}°</label>
                  <input type="range" min="-180" max="180" step="1" value={debugRotZ} onChange={e => setDebugRotZ(parseFloat(e.target.value))} className="w-full" />
                </div>
                <div className='border-t border-gray-300 pt-2 mt-2'>
                  <label className='block font-bold'>Box Scale (テストスポット用): {debugBoxScale}</label>
                  <input type="range" min="1" max="100" step="1" value={debugBoxScale} onChange={e => setDebugBoxScale(parseFloat(e.target.value))} className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {hatchOverlay?.active && (
        <div className='pointer-events-auto absolute inset-0 z-[130] overflow-hidden bg-black/80 flex flex-col items-center justify-center'>
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
                pointerEvents: 'none'
              }}
            />
          ))}
          <div className='text-center text-white drop-shadow-2xl pointer-events-none flex flex-col items-center gap-4 z-40'>
            {hatchOverlay.petName && (
              <div className='text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-pink-300 to-cyan-300 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-pulse tracking-widest leading-tight'>
                {hatchOverlay.petName}
              </div>
            )}
            <div className='text-5xl font-extrabold animate-bounce'>{hatchOverlay.rarity === 'UR' ? '🌈 UR!' : hatchOverlay.rarity === 'SR' ? '✨ SR' : hatchOverlay.rarity === 'R' ? '⭐ R' : 'N'}</div>
          </div>
          {hatchOverlay.showConfirm && (
            <button
              onClick={() => {
                if (hatchOverlay.resolve) hatchOverlay.resolve();
                setHatchOverlay(null);
              }}
              className='mt-12 bg-white text-black font-bold py-3 px-10 rounded-full shadow-lg active:scale-95 transition-transform z-50 pointer-events-auto animate-fade-in-up'
            >
              確認
            </button>
          )}
        </div>
      )}

      {itemRewardOverlay?.active && (
        <div className='absolute inset-0 z-[210] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4 text-black relative overflow-hidden'>
            <div className='absolute inset-0 pointer-events-none overflow-hidden'>
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className='absolute w-2 h-2 rounded-full opacity-70 animate-bounce'
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    background: ['#FDE68A', '#FCA5A5', '#FBCFE8', '#A7F3D0', '#93C5FD'][i % 5],
                    animationDelay: `${Math.random() * 0.6}s`,
                    animationDuration: `${1 + Math.random()}s`,
                  }}
                />
              ))}
            </div>
            <div className='relative'>
              <div className='text-5xl animate-bounce'>🎁</div>
              <h2 className='text-xl font-bold text-orange-600 mt-2'>
                {itemRewardOverlay.facilityIcon} {itemRewardOverlay.facilityName} からおみやげ！
              </h2>
              <p className='text-xs text-gray-500 mt-1'>アイテムを {itemRewardOverlay.items.length} つ手に入れました</p>
            </div>
            <div className='relative space-y-2 max-h-64 overflow-y-auto'>
              {itemRewardOverlay.items.map((item: any, idx: number) => (
                <div key={`${item.id}-${idx}`} className='bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-center gap-3 text-left shadow-sm'>
                  {item.image_url ? (
                    <img src={item.image_url} className='w-12 h-12 object-cover rounded-lg flex-shrink-0' />
                  ) : (
                    <div className='w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0'>
                      {item.item_type === 'food' ? '🍙' : item.item_type === 'sleep' ? '💤' : item.item_type === 'medicine' ? '💊' : item.item_type === 'exp' ? '✨' : '🎁'}
                    </div>
                  )}
                  <div className='min-w-0'>
                    <div className='font-bold text-orange-900 text-sm truncate'>{item.name}</div>
                    <div className='text-[10px] text-gray-500'>
                      {item.item_type === 'food' ? 'ごはん' : item.item_type === 'sleep' ? 'おやすみ薬' : item.item_type === 'medicine' ? 'お薬' : item.item_type === 'exp' ? '経験値アイテム' : 'アイテム'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setItemRewardOverlay(null)} className='relative w-full bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform'>
              受け取る
            </button>
          </div>
        </div>
      )}

      {isSpotFoundModalOpen && activeLandmark && (
        <div className='absolute inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4 text-black'>
            <div className='text-5xl mb-2'>
              {(activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hospital' ? '🏥' :
               (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'restaurant' ? '🍽️' :
               (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hotel' ? '🏨' : 
               activeLandmark.isCustom ? '🌟' : '📍'}
            </div>
            <h2 className='text-xl font-bold text-gray-800'>
              【{activeLandmark.name}】を発見！
            </h2>
            {visitedSpotsToday.has(String(activeLandmark.id)) ? (
              <p className='text-sm text-gray-500'>本日は既にチェックイン済みです。<br />また明日訪れてみましょう！</p>
            ) : (
              <p className='text-sm text-gray-600'>チェックインしてアイテムや経験値をゲットしますか？</p>
            )}
            
            <div className='space-y-3 mt-4'>
              {!visitedSpotsToday.has(String(activeLandmark.id)) && (
                <button
                  onClick={() => {
                    handleCheckIn();
                    setIsSpotFoundModalOpen(false);
                  }}
                  className='w-full bg-gradient-to-r from-teal-400 to-teal-600 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95'
                >
                  ✨ チェックインする
                </button>
              )}
              <button
                onClick={() => {
                  setLastDismissedSpotId(activeLandmark.id);
                  setIsSpotFoundModalOpen(false);
                }}
                className='w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl active:scale-95'
              >
                あとで
              </button>
            </div>
          </div>
        </div>
      )}

      {showRainbowBridge && (
        <div className='absolute inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 text-center text-white transition-opacity duration-1000'>
          {rainbowPhase === 1 && (
            <div className='animate-pulse space-y-6'>
              <h1 className='text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400'>🌈 虹の橋を渡りました...</h1>
              <p className='text-lg text-gray-300'>
                {displayName}はレベルMAXに到達し、虹の橋の向こう側へ旅立ちました。
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

      {showProfileSetup && (
        <div className='absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
          <form onSubmit={handleProfileSubmit} className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 relative text-black'>
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

      {isSettingsOpen && (
        <div className='absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-black max-h-[85vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-4 border-b pb-2 border-gray-200'>
              <h2 className='text-xl font-bold text-slate-800'>⚙️ 設定</h2>
              <button onClick={() => setIsSettingsOpen(false)} className='w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center active:scale-95'>
                ✕
              </button>
            </div>

            <form onSubmit={handleSettingsSave} className='space-y-4'>
              <div className='space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200'>
                <h3 className='font-bold text-sm text-gray-700 border-b pb-1'>システム設定</h3>
                <label className='flex justify-between items-center text-sm font-bold cursor-pointer'>
                  <span>通知</span>
                  <input type='checkbox' checked={isNotificationEnabled} onChange={e => setIsNotificationEnabled(e.target.checked)} className='w-5 h-5 accent-blue-600' />
                </label>
                <label className='flex justify-between items-center text-sm font-bold cursor-pointer'>
                  <span>サウンド</span>
                  <input type='checkbox' checked={isSoundEnabled} onChange={e => setIsSoundEnabled(e.target.checked)} className='w-5 h-5 accent-blue-600' />
                </label>
                <label className='flex justify-between items-center text-sm font-bold cursor-pointer'>
                  <span>エフェクト</span>
                  <input type='checkbox' checked={isEffectEnabled} onChange={e => setIsEffectEnabled(e.target.checked)} className='w-5 h-5 accent-blue-600' />
                </label>
              </div>

              <div className='space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200'>
                <h3 className='font-bold text-sm text-gray-700 border-b pb-1'>プロフィール変更</h3>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>誕生年</label>
                  <input type='number' value={inputBirthYear} onChange={e => setInputBirthYear(e.target.value)} className='w-full border p-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-black text-sm' required />
                </div>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>性別</label>
                  <select value={inputGender} onChange={e => setInputGender(e.target.value)} className='w-full border p-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-black text-sm' required>
                    <option value=''>選択...</option>
                    <option value='male'>男性</option>
                    <option value='female'>女性</option>
                    <option value='other'>その他</option>
                  </select>
                </div>
              </div>

              <button type='submit' disabled={isSetupSubmitting} className='w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg mt-4 disabled:bg-gray-400 active:scale-95 transition-transform'>
                {isSetupSubmitting ? '保存中...' : '設定を保存する'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showNamingScreen && (
        <div className='absolute inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
          <form onSubmit={handleNamingSubmit} className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 relative text-black'>
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

      {showMindfulness && (
        <div className='absolute inset-0 z-[160] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white text-center pointer-events-auto'>
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

      {isWalkPromptOpen && (
        <div className='absolute inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4 text-black'>
            <div className='text-5xl mb-2'>🚶</div>
            <h2 className='text-xl font-bold text-green-600'>さんぽに出かけよう！</h2>
            <p className='text-sm text-gray-700'>
              次のレベルアップまでに、あと<br/>
              <span className='text-2xl font-black text-green-600'>{Math.max(0, nextLevelRequirements.distance - Math.floor(walkDistance))}</span> m の歩行距離が必要です。
            </p>
            <p className='text-xs text-gray-500'>さんぽ（GPS）モードに切り替えて、<br/>ペットと一緒に歩いてみませんか？</p>
            <div className='space-y-2 mt-4'>
              <button onClick={() => handleModeChange('gps')} className='w-full bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95'>
                さんぽへ行く！
              </button>
              <button onClick={() => setIsWalkPromptOpen(false)} className='w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl active:scale-95'>
                あとで
              </button>
            </div>
          </div>
        </div>
      )}

      {isCareMenuOpen && (
        <div className='absolute bottom-24 left-1/2 -translate-x-1/2 z-[150] flex gap-3 pointer-events-auto'>
          <button
            onClick={handleOpenFoodMenu}
            className='flex flex-col items-center justify-center gap-1 bg-orange-500 text-white font-bold w-20 h-20 rounded-2xl shadow-2xl border-2 border-orange-200 active:scale-95 transition-transform'
          >
            <span className='text-2xl'>🍚</span>
            <span className='text-xs'>ごはん</span>
          </button>
          <button
            onClick={handleOpenSleepMenu}
            className='flex flex-col items-center justify-center gap-1 bg-indigo-500 text-white font-bold w-20 h-20 rounded-2xl shadow-2xl border-2 border-indigo-200 active:scale-95 transition-transform'
          >
            <span className='text-2xl'>💤</span>
            <span className='text-xs'>おやすみ</span>
          </button>
        </div>
      )}

      {isFoodMenuOpen && (
        <div className='absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-[150] border border-gray-200 pointer-events-auto'>
          <div className='flex justify-between items-center mb-4 border-b pb-3'>
            <h3 className='font-bold text-xl text-gray-800'>🍚 ごはんをあげる</h3>
            <button onClick={() => setIsFoodMenuOpen(false)} className='text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200'>
              閉じる
            </button>
          </div>
          {inventory.filter(i => i.item_masters.item_type === 'food').length === 0 ? (
            <p className='text-gray-500 text-center py-8'>持っているご飯がありません。<br/>おみせで買ってこよう！</p>
          ) : (
            <div className='flex gap-4 overflow-x-auto pb-2'>
              {inventory.filter(i => i.item_masters.item_type === 'food').map(invItem => (
                <button key={invItem.id} onClick={() => handleUseItem(invItem)} className='flex-shrink-0 bg-white border border-orange-100 rounded-2xl p-3 w-32 flex flex-col text-left shadow-sm active:scale-95 transition-transform'>
                  {invItem.item_masters.image_url ? (
                    <img src={invItem.item_masters.image_url} className='w-full h-16 object-cover rounded-lg mb-2' />
                  ) : (
                    <div className='w-full h-16 bg-orange-50 rounded-lg mb-2 flex items-center justify-center text-2xl'>🍙</div>
                  )}
                  <div className='font-bold text-orange-900 text-sm truncate'>{invItem.item_masters.name}</div>
                  <div className='mt-auto text-right text-xs font-bold text-orange-600 pt-2'>所持: {invItem.quantity}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isSleepMenuOpen && (
        <div className='absolute bottom-24 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-[150] border border-gray-200 pointer-events-auto'>
          <div className='flex justify-between items-center mb-4 border-b pb-3'>
            <h3 className='font-bold text-xl text-gray-800'>💤 おやすみさせる</h3>
            <button onClick={() => setIsSleepMenuOpen(false)} className='text-gray-500 font-bold px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200'>
              閉じる
            </button>
          </div>
          {isSleeping ? (
            <p className='text-gray-500 text-center py-8'>
              ペットは今おやすみ中です。
              <br />
              {sleepingUntil && `起床予定: ${new Date(sleepingUntil).toLocaleString()}`}
            </p>
          ) : inventory.filter(i => i.item_masters.item_type === 'sleep').length === 0 ? (
            <p className='text-gray-500 text-center py-8'>持っているおやすみ薬がありません。<br/>おみせで買ってこよう！</p>
          ) : (
            <div className='flex gap-4 overflow-x-auto pb-2'>
              {inventory.filter(i => i.item_masters.item_type === 'sleep').map(invItem => (
                <button key={invItem.id} onClick={() => handleUseItem(invItem)} className='flex-shrink-0 bg-white border border-indigo-100 rounded-2xl p-3 w-32 flex flex-col text-left shadow-sm active:scale-95 transition-transform'>
                  {invItem.item_masters.image_url ? (
                    <img src={invItem.item_masters.image_url} className='w-full h-16 object-cover rounded-lg mb-2' />
                  ) : (
                    <div className='w-full h-16 bg-indigo-50 rounded-lg mb-2 flex items-center justify-center text-2xl'>💤</div>
                  )}
                  <div className='font-bold text-indigo-900 text-sm truncate'>{invItem.item_masters.name}</div>
                  <div className='text-[10px] text-indigo-500'>{invItem.item_masters.effect_value}時間 おやすみ</div>
                  <div className='mt-auto text-right text-xs font-bold text-indigo-600 pt-2'>所持: {invItem.quantity}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isHelpModalOpen && (
        <div className='absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-black max-h-[85vh] overflow-y-auto'>
            <h2 className='text-2xl font-bold text-center border-b pb-3 mb-4 text-slate-800 flex items-center justify-center gap-2'>
              <span>❓</span>遊び方ガイド
            </h2>
            <div className='space-y-4 text-sm'>
              <div className='bg-pink-50 p-3 rounded-xl border border-pink-100'>
                <h3 className='font-bold text-pink-700 mb-1'>❤️ 育てる</h3>
                <p className='text-gray-700 leading-relaxed'>
                  ペットをタップして撫でたり、アイテムのごはんをあげてごきげんをとりましょう。<br/>愛情が深まるほど成長しやすくなります。
                </p>
              </div>
              <div className='bg-green-50 p-3 rounded-xl border border-green-100'>
                <h3 className='font-bold text-green-700 mb-1'>🚶 出かける (さんぽ)</h3>
                <p className='text-gray-700 leading-relaxed'>
                  「さんぽ」モードで現実世界を歩くと、GPSで歩行距離がカウントされます。<br/>レベルアップや孵化の重要な条件になります。
                </p>
              </div>
              <div className='bg-blue-50 p-3 rounded-xl border border-blue-100'>
                <h3 className='font-bold text-blue-700 mb-1'>📍 スポットに行く</h3>
                <p className='text-gray-700 leading-relaxed'>
                  マップ上にあるランドマーク（施設）に近づいてチェックイン！<br/>大量の経験値や回復ボーナスがもらえます。訪問先の種類に応じて、ごはん・おやすみ薬などのアイテムもおみやげとしてもらえます。
                </p>
              </div>
              <div className='bg-yellow-50 p-3 rounded-xl border border-yellow-100'>
                <h3 className='font-bold text-yellow-700 mb-1'>🌟 経験値を貯めて進化！</h3>
                <p className='text-gray-700 leading-relaxed'>
                  歩数・給餌の全ての条件を満たすとレベルアップ！<br/>レベルが上がると姿が変わるかも…？<br/>最大レベル99を目指しましょう！
                </p>
              </div>
            </div>
            <button onClick={() => setIsHelpModalOpen(false)} className='mt-6 w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95'>
              わかった！
            </button>
          </div>
        </div>
      )}

      {isEncyclopediaOpen && (
        <div className='absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto' onClick={() => setIsEncyclopediaOpen(false)}>
          <div className='bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl relative max-h-[85vh] flex flex-col' onClick={e => e.stopPropagation()}>
            <div className='flex justify-between items-center mb-4 border-b pb-2 border-gray-200'>
              <h2 className='text-xl font-bold text-slate-800'>📖 記録と図鑑</h2>
              <button onClick={() => setIsEncyclopediaOpen(false)} className='w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center active:scale-95'>
                ✕
              </button>
            </div>

            <div className='flex mb-4 gap-2'>
              <button onClick={() => setEncyclopediaTab('pets')} className={`flex-1 py-2 font-bold rounded-xl text-sm transition-colors ${encyclopediaTab === 'pets' ? 'bg-indigo-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                🐶 ペット
              </button>
              <button onClick={() => setEncyclopediaTab('spots')} className={`flex-1 py-2 font-bold rounded-xl text-sm transition-colors ${encyclopediaTab === 'spots' ? 'bg-teal-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                📍 スポット
              </button>
            </div>

            <div className='flex-1 overflow-y-auto pr-1'>
              {encyclopediaTab === 'pets' && (
                <div className='space-y-4'>
                  <div className='text-sm text-gray-600 flex justify-between px-1'>
                    <span>獲得状況: {acquiredPetIds.size} / {allPetMasters.length}</span>
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    {allPetMasters.map(pm => {
                      const isAcquired = acquiredPetIds.has(pm.id);
                      const isHallOfFame = hallOfFamePetIds.has(pm.id);
                      const fallbackBase = `/models/pet/${pm.rarity || 'N'}/v1.glb`;
                      return (
                        <div key={pm.id} className='relative bg-gray-50 border border-gray-200 rounded-xl p-2 flex flex-col items-center shadow-sm'>
                          {isHallOfFame && <div className='absolute -top-3 -right-3 text-4xl z-20 drop-shadow-md'>⭐</div>}
                          <div className='w-full h-28 rounded-lg overflow-hidden bg-white border border-gray-100 relative flex items-center justify-center'>
                            <ModelViewer
                              src={pm.model_url || fallbackBase}
                              camera-controls="false"
                              auto-rotate="true"
                              style={{ width: '100%', height: '100%', backgroundColor: 'transparent', filter: isAcquired ? 'none' : 'brightness(0)' }}
                            ></ModelViewer>
                          </div>
                          <div className={`mt-2 text-sm font-bold truncate w-full text-center ${isAcquired ? 'text-gray-800' : 'text-gray-400'}`}>
                            {isAcquired ? pm.name : '？？？？'}
                          </div>
                          {isAcquired && <div className='text-[10px] text-gray-500'>レアリティ: {pm.rarity || '?'}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {encyclopediaTab === 'spots' && (
                <div className='space-y-4'>
                  <div className='bg-teal-50 p-4 rounded-xl border border-teal-100 shadow-sm'>
                    <h4 className='font-bold text-teal-800 mb-2 text-sm'>📸 思い出のスポットを記録</h4>
                    <input type='text' placeholder='スポットの名前 (例: 近所の公園)' value={newSpotName} onChange={e => setNewSpotName(e.target.value)} className='w-full p-2 border border-teal-200 rounded-lg mb-2 text-black text-sm' />
                    <input type='file' accept='image/*' onChange={e => setNewSpotFile(e.target.files?.[0] || null)} className='w-full text-xs text-gray-600 mb-3 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-100 file:text-teal-700 hover:file:bg-teal-200' />
                    <button onClick={handleAddCustomSpot} disabled={isUploadingSpot || !newSpotName || !newSpotFile} className='w-full bg-teal-600 text-white font-bold py-2.5 rounded-lg disabled:bg-gray-300 text-sm active:scale-95 transition-transform'>
                      {isUploadingSpot ? '保存中...' : '図鑑に記録する'}
                    </button>
                  </div>

                  {customSpots.length === 0 ? (
                    <p className='text-gray-400 text-center text-sm py-8'>まだ記録されたスポットがありません。</p>
                  ) : (
                    <div className='grid grid-cols-2 gap-3'>
                      {customSpots.map(spot => (
                        <div key={spot.id} className='bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm'>
                          <img src={spot.image_url} alt={spot.name} className='w-full h-24 object-cover' />
                          <div className='p-2'>
                            <div className='text-sm font-bold text-gray-800 truncate'>{spot.name}</div>
                            <div className='text-[10px] text-gray-500 mt-0.5'>{new Date(spot.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSpotMapOpen && (
        <div className='absolute inset-0 z-[320] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto' onClick={() => setIsSpotMapOpen(false)}>
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
                <div className='flex gap-2 mb-3 justify-center'>
                  <button
                    onClick={() => setMapZoomLevel(Math.max(1, mapZoomLevel - 1))}
                    className='bg-blue-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-600 active:scale-95 transition-transform text-sm'
                  >
                    🔍− ズームアウト
                  </button>
                  <span className='text-sm font-bold text-gray-600 px-3 py-2 bg-gray-100 rounded-lg'>
                    レベル: {mapZoomLevel}
                  </span>
                  <button
                    onClick={() => setMapZoomLevel(Math.min(5, mapZoomLevel + 1))}
                    className='bg-blue-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-600 active:scale-95 transition-transform text-sm'
                  >
                    🔍+ ズームイン
                  </button>
                </div>
                <div className='relative w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-4 shadow-inner border border-gray-300'>
                  {(() => {
                    const zoomFactors: Record<number, number> = { 1: 0.01, 2: 0.007, 3: 0.005, 4: 0.003, 5: 0.001 };
                    const factor = zoomFactors[mapZoomLevel] || 0.005;
                    const bbox = `${location.lng - factor}%2C${location.lat - factor}%2C${location.lng + factor}%2C${location.lat + factor}`;
                    return (
                      <iframe
                        key={`map-${mapZoomLevel}`}
                        width='100%'
                        height='100%'
                        frameBorder='0'
                        scrolling='no'
                        marginHeight={0}
                        marginWidth={0}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`}
                        className='absolute inset-0 z-0 pointer-events-none'
                      ></iframe>
                    );
                  })()}
                  <div className='absolute inset-0 z-10 flex items-center justify-center pointer-events-none'>
                    <div className='w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-md animate-pulse'></div>
                  </div>
                  <div className='absolute inset-0 z-20 pointer-events-none'>
                    {allMapSpots.map((spot, idx) => {
                      const master = spot.landmark_masters;
                      const facilityType = spot.isCustom ? 'custom' : (master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(spot.name));
                      const typeIcon = facilityType === 'hospital' ? '🏥' : facilityType === 'restaurant' ? '🍽️' : facilityType === 'hotel' ? '🏨' : facilityType === 'custom' ? '🌟' : '📍';
                      const zoomFactors: Record<number, number> = { 1: 0.01, 2: 0.007, 3: 0.005, 4: 0.003, 5: 0.001 };
                      const factor = zoomFactors[mapZoomLevel] || 0.005;
                      const topPercent = 50 - ((spot.latitude - location.lat) / (factor * 2)) * 100;
                      const leftPercent = 50 + ((spot.longitude - location.lng) / (factor * 2)) * 100;
                      return (
                        <div key={`radar-${spot.id || idx}`} className='absolute w-12 h-12 -ml-6 -mt-6 text-2xl flex items-center justify-center filter drop-shadow bg-white/90 rounded-full border-2 border-gray-300 shadow-md' style={{ top: `${topPercent}%`, left: `${leftPercent}%` }} title={spot.name}>
                          {typeIcon}
                        </div>
                      );
                    })}
                  </div>
                </div>

{(() => {
const nearbySpots = allMapSpots.filter(spot => {
  const dist = getDistance(location.lat, location.lng, spot.latitude, spot.longitude);
  return dist <= 60000;
}).sort((a, b) => {
  const masterA = a.landmark_masters;
  const masterB = b.landmark_masters;
  const facilityTypeA = a.isCustom ? 'custom' : (masterA?.facility_type && masterA.facility_type !== 'normal' ? masterA.facility_type : getFacilityType(a.name));
  const facilityTypeB = b.isCustom ? 'custom' : (masterB?.facility_type && masterB.facility_type !== 'normal' ? masterB.facility_type : getFacilityType(b.name));

  const isSpecialA = facilityTypeA === 'special' ? 0 : 1;
  const isSpecialB = facilityTypeB === 'special' ? 0 : 1;
  if (isSpecialA !== isSpecialB) return isSpecialA - isSpecialB; // 特別スポットを先頭に

  const distA = getDistance(location.lat, location.lng, a.latitude, a.longitude);
  const distB = getDistance(location.lat, location.lng, b.latitude, b.longitude);
  return distA - distB; // 同じ優先度内は距離順
});

  return (
    <div className='space-y-3'>
      {nearbySpots.map((spot, idx) => {
        const dist = getDistance(location.lat, location.lng, spot.latitude, spot.longitude);
        const master = spot.landmark_masters;
        const facilityType = spot.isCustom ? 'custom' : (master?.facility_type && master.facility_type !== 'normal' ? master.facility_type : getFacilityType(spot.name));
        return (
          <div key={`list-${spot.id || idx}`} className='bg-gray-50 border rounded-xl p-3 flex justify-between items-center shadow-sm'>
            <div>
              <div className='font-bold text-gray-800 flex items-center gap-1'>
                {facilityType === 'hospital' ? '🏥' : facilityType === 'restaurant' ? '🍽️' : facilityType === 'hotel' ? '🏨' : facilityType === 'custom' ? '🌟' : '📍'} {spot.name}
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
      {nearbySpots.length === 0 && <p className='text-xs text-gray-500 text-center py-4'>周辺60km圏内にスポットが見つかりません</p>}
    </div>
  );
})()}
              </div>
            )}

            <button onClick={() => setIsSpotMapOpen(false)} className='mt-4 w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl active:scale-95 transition-transform'>
              閉じる
            </button>
          </div>
        </div>
      )}

      {loginBonusState.showModal && (
        <div className='absolute inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
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

      {isNewsOpen && (
        <div className='absolute top-20 left-4 right-4 bg-white/95 p-5 rounded-3xl shadow-2xl backdrop-blur-md z-50 border border-gray-200 pointer-events-auto'>
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
                    <div key={n.id} className='bg-pink-50 border border-pink-100 rounded-xl p-3 text-black'>
                      <h4 className='font-bold text-pink-900 text-sm mb-1'>{n.title}</h4>
                      <p className='text-xs text-gray-700 whitespace-pre-wrap'>{n.content}</p>
                      {n.title === 'すれ違い通信' ? (
                        <button
                          onClick={() => handleReceiveEncounterItem(n)}
                          className='mt-3 w-full bg-pink-500 text-white font-bold py-2 rounded-lg text-sm active:scale-95'
                        >
                          🎁 受け取る
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await supabase.from('user_notifications').delete().eq('id', n.id);
                            setUserNotifications(prev => prev.filter(notif => notif.id !== n.id));
                          }}
                          className='mt-3 w-full bg-gray-300 text-gray-700 font-bold py-2 rounded-lg text-sm active:scale-95'
                        >
                          確認して消す
                        </button>
                      )}
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
                  {newsList.map(news => {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const urls = news.content.match(urlRegex) || [];
                    const contentWithoutUrl = news.content.replace(urlRegex, '').trim();

                    return (
                      <div key={news.id} className='bg-blue-50 border border-blue-100 rounded-xl p-3 text-black'>
                        <h4 className='font-bold text-blue-900 text-sm mb-1'>{news.title}</h4>
                        <p className='text-xs text-gray-700 whitespace-pre-wrap'>{contentWithoutUrl || news.content}</p>
                        {urls.length > 0 && (
                          <div className='mt-2 space-y-1'>
                            {urls.map((url: string, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => window.open(url, '_blank')}
                                className='block text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline bg-blue-100 px-2 py-1 rounded transition-colors w-full text-left'
                              >
                                📎 {url.substring(0, 50)}...
                              </button>
                            ))}
                          </div>
                        )}
                        <div className='text-[10px] text-gray-500 mt-2 text-right'>{new Date(news.published_at).toLocaleDateString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isStatusModalOpen && (
        <div className='absolute inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
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
                </div>
              </div>
            )}

            {!isEgg && !isEggUnregistered && petId && (
              <>
                <div className='mb-2'>
                  <div className='flex justify-between items-end border-b border-gray-700 pb-2 mb-2'>
                    <span className='text-xs text-gray-400'>🐾 ペット種族</span>
                    <span className='text-lg font-bold text-white'>{petMasterName}</span>
                  </div>
                </div>

                {petAttributes.length > 0 && (
                  <div className='mb-2'>
                    <div className='text-xs font-bold text-gray-400 mb-1.5'>🔮 属性</div>
                    <div className='flex flex-wrap gap-2'>
                      {petAttributes.map(attr => (
                        <span key={attr.id} className='bg-gray-800 border border-gray-600 px-2 py-1 rounded text-xs font-bold text-gray-200 shadow-sm'>
                          {attr.name}
                        </span>
                      ))}
                    </div>

                    {petAttributeWeaknesses.length > 0 && (
                      <div className='mt-2 text-xs font-bold text-red-400 mb-1.5'>⚠️ 弱点属性 (被ダメージUP)</div>
                    )}
                    {petAttributeWeaknesses.length > 0 && (
                      <div className='flex flex-wrap gap-2'>
                        {petAttributeWeaknesses.map((weakness: any) => (
                          <div key={`weakness-${weakness.id}`} className='flex items-center gap-1'>
                            <span className='bg-red-900 border border-red-600 px-2 py-1 rounded text-xs font-bold text-red-200 shadow-sm'>
                              {weakness.weak_against?.name || '?'}
                            </span>
                            <span className='text-xs text-gray-500'>← 弱点</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showConditionSOS && !isEgg && petCondition !== 'healthy' && (
        <div className='absolute top-24 left-4 right-4 z-[100] animate-bounce pointer-events-auto'>
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

      {sessionUserId && viewMode !== 'report' && (
        <div className='absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none'>
          <div className='flex justify-between items-end'>
            {!isEggUnregistered && !customName ? (
              <button
                onClick={() => { setNamingInput(''); setShowNamingScreen(true); playSound('tap'); }}
                className='pointer-events-auto text-white font-bold text-lg drop-shadow-lg bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm border border-white/30 active:scale-95 transition-transform flex items-center gap-1'
              >
                ✏️ 名前をつける
              </button>
            ) : (
              <span className='text-white font-bold text-3xl drop-shadow-lg bg-black/30 px-3 py-1 rounded-xl backdrop-blur-sm'>{isEggUnregistered ? '' : displayName}</span>
            )}
            <span className={`${currentMood.color} text-white px-4 py-2 rounded-xl font-bold shadow-xl text-md transition-colors duration-300 border border-white/20 pointer-events-auto`}>{currentMood.text}</span>
            {isDebugMode() && !isEgg && (
              <span className='text-white font-bold text-xs drop-shadow-lg bg-black/50 px-2 py-1 rounded border border-yellow-400 backdrop-blur-sm'>
                🎬 Anim: {actionAnim || currentMood.clip}
              </span>
            )}
          </div>
        </div>
      )}

      {viewMode !== 'report' && (
        <div className='absolute top-20 right-4 z-[140] flex flex-col gap-4 pointer-events-auto'>
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

          <button onClick={() => { setIsSettingsOpen(true); playSound('tap'); }} className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 flex items-center justify-center w-14 h-14 relative' aria-label='設定'>
            <span className='text-2xl'>⚙️</span>
          </button>

          <button onClick={() => { setIsHelpModalOpen(true); playSound('tap'); }} className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 flex items-center justify-center w-14 h-14 relative' aria-label='遊び方'>
            <span className='text-2xl font-bold text-gray-700'>❓</span>
          </button>

          <button onClick={() => { setIsEncyclopediaOpen(true); playSound('tap'); }} className='bg-white/90 p-3 rounded-full shadow-2xl border border-gray-200 active:scale-90 flex items-center justify-center w-14 h-14 relative' aria-label='ずかん'>
            <span className='text-2xl'>📖</span>
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
        <div className='absolute inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto'>
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

      {viewMode === 'report' && (
        <div className='absolute inset-0 z-30 bg-black/90 text-white overflow-y-auto pb-32 pt-10 px-6 backdrop-blur-md pointer-events-auto'>
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

        {viewMode === 'gps' && (
          <>
            <div className='bg-green-600/90 text-white p-3 rounded-xl font-bold shadow-lg w-full text-center text-sm backdrop-blur-sm'>
              {location ? `🚶‍♂️ 現在地周辺を散歩中... ${petId ? `(歩行: ${Math.floor(walkDistance)}m / 約${stepCount}歩)` : ''}` : '📡 GPSを探索中...'}
            </div>
            {activeLandmark && !isSpotFoundModalOpen && !isEgg && petId && (
              <button
                onClick={() => setIsSpotFoundModalOpen(true)}
                className={`p-4 rounded-2xl font-bold shadow-2xl w-full border-4 animate-bounce text-lg text-white 
                  ${(activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hospital'
                    ? 'bg-gradient-to-br from-purple-400 to-purple-600 border-purple-200'
                    : (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'restaurant'
                    ? 'bg-gradient-to-br from-red-400 to-red-600 border-red-200'
                    : (activeLandmark.landmark_masters?.facility_type || getFacilityType(activeLandmark.name)) === 'hotel'
                    ? 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-200'
                    : 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-200 text-yellow-900'}`}
              >
                ✨ 【{activeLandmark.name}】が近くにあります！
                <br />
                タップして確認する
              </button>
            )}
          </>
        )}

        {viewMode !== 'report' && (
          <button
            onClick={() => { closeAllMenus(); setIsSpotMapOpen(true); playSound('tap'); }}
            className='bg-gradient-to-r from-teal-400 to-teal-600 text-white p-3 rounded-2xl font-bold shadow-lg w-full flex justify-center items-center gap-2 border-2 border-teal-300 active:scale-95 transition-transform text-lg'
          >
            🗺️ 地図でスポットを探す
          </button>
        )}

        <div className='grid grid-cols-5 gap-1 bg-white p-3 rounded-2xl shadow-xl border border-gray-100'>
          <button onClick={() => handleModeChange('mindar')} className={`min-w-0 font-bold flex flex-col items-center gap-1 ${viewMode === 'mindar' ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className='text-xl'>🏠</span>
            <span className='text-xs'>おうち</span>
          </button>
          <button onClick={() => handleModeChange('gps')} className={`min-w-0 font-bold flex flex-col items-center gap-1 ${viewMode === 'gps' ? 'text-green-600' : 'text-gray-400'}`}>
            <span className='text-xl'>🚶</span>
            <span className='text-xs'>さんぽ</span>
          </button>
          <button
            onClick={handleOpenCareMenu}
            className={`min-w-0 font-bold flex flex-col items-center gap-1 ${isCareMenuOpen ? 'text-pink-600' : 'text-gray-400'}`}
          >
            <span className='text-xl'>🍙</span>
            <span className='text-xs'>おせわ</span>
          </button>
          <button
            onClick={() => {
              closeAllMenus();
              setIsInventoryOpen(true);
              setNewInventoryCount(0);
              playSound('tap');
            }}
            className={`min-w-0 font-bold flex flex-col items-center gap-1 relative ${isInventoryOpen ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <span className='relative text-xl'>
              🎒
              {newInventoryCount > 0 && (
                <span className='absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 border border-white text-[10px] leading-4 text-white'>
                  {newInventoryCount}
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

      <div
        ref={arViewportRef}
        className={`ar-camera-viewport absolute inset-0 z-[1] pointer-events-none${
          viewMode === 'mindar' && cameraReady && !isEgg && !isEggUnregistered && !isSleeping ? ' mindar-clickable' : ''
        }`}
      >
        {itemActionEffect && (() => {
          const progress = itemActionProgress;
          const startX = itemActionEffect.startX;
          const startY = itemActionEffect.startY;
          const endX = itemActionEffect.endX;
          const endY = itemActionEffect.endY;
          const arcLift = itemActionEffect.arcLift;
          const throwT = Math.min(Math.max(progress, 0), 1);
          const xBase = startX + (endX - startX) * throwT;
          const yBase = startY + (endY - startY) * throwT;
          const tossX = (itemActionEffect.kind === 'food' ? 18 : itemActionEffect.kind === 'medicine' ? -14 : itemActionEffect.kind === 'sleep' ? 13 : 16) * (1 - throwT);
          const tossY = Math.sin(throwT * Math.PI) * arcLift;
          const x = xBase + tossX;
          const y = yBase - tossY;
          const rotation = itemActionEffect.kind === 'medicine' ? -24 + progress * 220 : itemActionEffect.kind === 'food' ? progress * 600 : itemActionEffect.kind === 'sleep' ? -18 + progress * 260 : progress * 440;
          const scale = 1 + progress * 0.36;
          const emphasis = itemActionEffect.kind === 'medicine' ? Math.max(0, 1 - progress) : 1 - progress * 0.82;
          const particles = Array.from({ length: itemActionEffect.kind === 'medicine' ? 14 : 9 });
          const beaconPulse = (index: number, p: number) => (Math.sin((p * 10 + index) * 2.4) + 1) / 2;
          const medicineRays = Array.from({ length: 5 });

          const moodBadge = itemActionEffect.reactionMood === 'happy'
            ? '💖'
            : itemActionEffect.reactionMood === 'sleepy'
              ? '💤'
              : '✨';
          const badgePosX = itemActionEffect.kind === 'medicine' ? endX + 12 : endX + 8;
          const badgePosY = itemActionEffect.kind === 'medicine' ? endY - 12 : endY - 18;
          const moodAura = itemActionEffect.reactionMood === 'happy'
            ? 'rgba(255, 128, 183, 0.45)'
            : itemActionEffect.reactionMood === 'sleepy'
              ? 'rgba(147, 197, 253, 0.42)'
              : 'rgba(250, 204, 21, 0.48)';

          return (
            <div className='absolute inset-0 z-[30] pointer-events-none'>
              {itemActionEffect.kind === 'medicine' && medicineRays.map((_, index) => {
                const beamT = Math.min(Math.max(progress * 1.3 - index * 0.08, 0), 1);
                const bx = startX + (endX - startX) * beamT;
                const by = startY + (endY - startY) * beamT + (index - 2) * 2.8;
                const beamScale = 18 + beaconPulse(index, progress) * 12;
                return (
                  <div
                    key={`beam-${index}`}
                    className='absolute h-[6px] rounded-full shadow-[0_0_18px_rgba(34,211,238,0.9)]'
                    style={{
                      left: `${bx}%`,
                      top: `${by}%`,
                      width: `${beamScale}%`,
                      background: 'linear-gradient(90deg, rgba(34,211,238,0), rgba(125,211,252,0.95), rgba(34,211,238,0))',
                      transform: `translate(-18%, -50%) rotate(${(-16 + index * 8) + progress * 30}deg)`,
                      opacity: `${Math.max(0, 0.7 - progress * 0.3)}`,
                    }}
                  />
                );
              })}

              {itemActionEffect.kind === 'medicine' && (
                <div
                  className='absolute rounded-full border-4 border-cyan-200/90 shadow-[0_0_26px_rgba(103,232,249,0.9)]'
                  style={{
                    left: `${endX}%`,
                    top: `${endY}%`,
                    width: `${22 + progress * 32}px`,
                    height: `${22 + progress * 32}px`,
                    transform: `translate(-50%, -50%) scale(${1 + progress * 1.1})`,
                    opacity: `${Math.max(0, 0.95 - progress * 0.7)}`,
                  }}
                />
              )}

              <div
                className='absolute rounded-full blur-2xl'
                style={{
                  left: `${endX}%`,
                  top: `${endY}%`,
                  width: `${70 + progress * 90}px`,
                  height: `${70 + progress * 90}px`,
                  transform: `translate(-50%, -50%) scale(${0.6 + progress * 1.2})`,
                  background: moodAura,
                  opacity: `${Math.max(0, 0.9 - progress * 0.5)}`,
                }}
              />

              <div
                className='absolute flex items-center justify-center rounded-full border border-white/70 bg-white/85 shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm'
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: itemActionEffect.kind === 'medicine' ? '3.25rem' : '4rem',
                  height: itemActionEffect.kind === 'medicine' ? '3.25rem' : '4rem',
                  transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
                  opacity: `${emphasis}`,
                }}
              >
                <span className='text-3xl drop-shadow-sm'>{itemActionEffect.emoji}</span>
              </div>

              <div
                className='absolute flex items-center justify-center rounded-full border border-white/80 bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.8)] backdrop-blur-sm'
                style={{
                  left: `${badgePosX}%`,
                  top: `${badgePosY}%`,
                  width: '2.4rem',
                  height: '2.4rem',
                  transform: `translate(-50%, -50%) scale(${0.9 + progress * 0.7})`,
                  opacity: `${Math.max(0, 1 - progress * 0.2)}`,
                }}
              >
                <span className='text-lg'>{moodBadge}</span>
              </div>

              {particles.map((_, index) => {
                const burstProgress = Math.max(0, (progress - 0.58) / 0.42);
                const particleX = endX + (index % 2 === 0 ? -10 : 10) + Math.sin(index * 1.8) * (12 + burstProgress * 20);
                const particleY = endY + (index % 3 === 0 ? -12 : 8) + Math.cos(index * 2.1) * (12 + burstProgress * 20);
                const particleOpacity = Math.max(0, 1 - burstProgress);
                return (
                  <span
                    key={`${itemActionEffect.kind}-${index}`}
                    className='absolute rounded-full bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.8)]'
                    style={{
                      left: `${particleX}%`,
                      top: `${particleY}%`,
                      width: `${7 + index * 1.4}px`,
                      height: `${7 + index * 1.4}px`,
                      opacity: `${particleOpacity}`,
                      transform: `translate(-50%, -50%) scale(${1 + burstProgress * 1.35})`,
                      background: itemActionEffect.trailColor,
                    }}
                  />
                );
              })}
            </div>
          );
        })()}

        {viewMode === 'mindar' && sessionUserId && isDataLoaded && scriptsReadyForMindar && !isSwitchingMode && (
          <div key={`mindar-container-${sceneKey}`} className='absolute inset-0 pointer-events-none'>
            <a-scene
              embedded
              style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', pointerEvents: 'auto' }}
              mindar-image={`imageTargetSrc: ${petMarkerUrl}; autoStart: true; uiLoading: no; uiError: no; maxTrack: 1; filterMinCF: 0.0001; filterBeta: 0.001;`}
              renderer='alpha: true; preserveDrawingBuffer: true; colorManagement: true; physicallyCorrectLights: true;'
              color-space='sRGB'
              vr-mode-ui='enabled: false'
              device-orientation-permission-ui='enabled: false'
              onLoad={(e: any) => {
                const sceneEl = e?.target;
                sceneEl?.addEventListener?.('arError', (err: any) => {
                  console.error('MindAR起動エラー:', err?.detail || err);
                });
              }}
            >
              <a-assets>
                <a-asset-item id='pet-asset' src={activeModelUrl}></a-asset-item>
              </a-assets>
              <a-light type='ambient' color='#ffffff' intensity='0.5'></a-light>
              <a-light type='directional' color='#ffffff' intensity='1.5' position='-1 2 1' castShadow='true'></a-light>

              <a-camera position='0 0 0' look-controls='enabled: false' cursor='rayOrigin: mouse; fuse: false;' raycaster='objects: .clickable'></a-camera>

              <a-entity mindar-image-target='targetIndex: 0' id='marker-target-0' mindar-event-listener="">
                <a-entity
                  id='pet-hitbox-0'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  geometry='primitive: cylinder; radius: 1.5; height: 3'
                  material='transparent: true; opacity: 0; depthWrite: false'
                  position='0 1.5 0'
                  pet-interact
                ></a-entity>
                
                <a-entity 
                  id='pet-anim-wrapper-0' 
                  pet-anim-controller={`clip: ${(!isEgg && debugAnimEnabled) ? currentAnim : ''}`}
                >
                  <a-gltf-model
                    id='pet-model-0'
                    src='#pet-asset'
                    position='0 0 0'
                    scale={`${debugScaleX} ${debugScaleY} ${debugScaleZ}`}
                    rotation={`${debugRotX} ${debugRotY} ${debugRotZ}`}
                  ></a-gltf-model>
                </a-entity>
              </a-entity>

              {/* マーカー 2 */}
              <a-entity mindar-image-target='targetIndex: 1' id='marker-target-1' mindar-event-listener="">
                <a-entity
                  id='pet-hitbox-1'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  geometry='primitive: cylinder; radius: 1.5; height: 3'
                  material='transparent: true; opacity: 0; depthWrite: false'
                  position='0 1.5 0'
                  pet-interact
                ></a-entity>
                <a-entity 
                  id='pet-anim-wrapper-1' 
                  pet-anim-controller={`clip: ${(!isEgg && debugAnimEnabled) ? currentAnim : ''}`}
                >
                  <a-gltf-model
                    id='pet-model-1'
                    src='#pet-asset'
                    position='0 0 0'
                    scale={`${debugScaleX} ${debugScaleY} ${debugScaleZ}`}
                    rotation={`${debugRotX} ${debugRotY} ${debugRotZ}`}
                  ></a-gltf-model>
                </a-entity>
              </a-entity>

              {/* マーカー 3 */}
              <a-entity mindar-image-target='targetIndex: 2' id='marker-target-2' mindar-event-listener="">
                <a-entity
                  id='pet-hitbox-2'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  geometry='primitive: cylinder; radius: 1.5; height: 3'
                  material='transparent: true; opacity: 0; depthWrite: false'
                  position='0 1.5 0'
                  pet-interact
                ></a-entity>
                <a-entity 
                  id='pet-anim-wrapper-2' 
                  pet-anim-controller={`clip: ${(!isEgg && debugAnimEnabled) ? currentAnim : ''}`}
                >
                  <a-gltf-model
                    id='pet-model-2'
                    src='#pet-asset'
                    position='0 0 0'
                    scale={`${debugScaleX} ${debugScaleY} ${debugScaleZ}`}
                    rotation={`${debugRotX} ${debugRotY} ${debugRotZ}`}
                  ></a-gltf-model>
                </a-entity>
              </a-entity>

              {/* マーカー 4 */}
              <a-entity mindar-image-target='targetIndex: 3' id='marker-target-3' mindar-event-listener="">
                <a-entity
                  id='pet-hitbox-3'
                  class={(!isEgg && !isSleeping) ? 'clickable' : ''}
                  geometry='primitive: cylinder; radius: 1.5; height: 3'
                  material='transparent: true; opacity: 0; depthWrite: false'
                  position='0 1.5 0'
                  pet-interact
                ></a-entity>
                <a-entity 
                  id='pet-anim-wrapper-3' 
                  pet-anim-controller={`clip: ${(!isEgg && debugAnimEnabled) ? currentAnim : ''}`}
                >
                  <a-gltf-model
                    id='pet-model-3'
                    src='#pet-asset'
                    position='0 0 0'
                    scale={`${debugScaleX} ${debugScaleY} ${debugScaleZ}`}
                    rotation={`${debugRotX} ${debugRotY} ${debugRotZ}`}
                  ></a-gltf-model>
                </a-entity>
              </a-entity>
            </a-scene>
          </div>
        )}

        {viewMode === 'gps' && sessionUserId && isDataLoaded && scriptsReadyForGps && !isSwitchingMode && (
          <div key={`gps-container-${sceneKey}`} className='absolute inset-0 pointer-events-none'>
            <a-scene
              embedded
              style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', pointerEvents: 'none' }}
              vr-mode-ui='enabled: false'
              arjs={`sourceType: webcam; sourceWidth:1280; sourceHeight:960; displayWidth: 1280; displayHeight: 960; debugUIEnabled: false; trackingMethod: best; sourceFacingMode: ${cameraFacing};`}
              renderer='alpha: true; antialias: true; logarithmicDepthBuffer: true;'
            >
              <a-assets>
                <a-asset-item id='pet-asset-gps' src={activeModelUrl}></a-asset-item>
              </a-assets>
              
              <a-camera gps-camera rotation-reader>
                {/* GPSモードではカメラの前に常にペットを表示（卵が未登録・卵の状態・睡眠中を除く） */}
                {!isEggUnregistered && !isSleeping && !isEgg && (
                  <a-entity position='0 -1.5 -3' rotation='0 0 0'>
                    <a-entity pet-anim-controller={`clip: ${(!isEgg && debugAnimEnabled) ? currentAnim : ''}`}>
                      <a-gltf-model
                        src='#pet-asset-gps'
                        scale={`${debugScaleX} ${debugScaleY} ${debugScaleZ}`}
                        rotation={`${debugRotX} ${debugRotY} ${debugRotZ}`}
                      ></a-gltf-model>
                    </a-entity>
                  </a-entity>
                )}
              </a-camera>

              {/* テストスポットのAR表示 */}
              {allMapSpots.map(spot => {
                if (spot.id.toString().startsWith('debug-spot-')) {
                  return (
                    <a-box
                      key={spot.id}
                      gps-entity-place={`latitude: ${spot.latitude}; longitude: ${spot.longitude};`}
                      scale={`${debugBoxScale} ${debugBoxScale} ${debugBoxScale}`}
                      color="red"
                    ></a-box>
                  );
                }
                
                // 通常のスポットの場合（仮で黄色の箱を表示）
                return (
                  <a-entity
                    key={spot.id}
                    gps-entity-place={`latitude: ${spot.latitude}; longitude: ${spot.longitude};`}
                  >
                    <a-box scale="5 5 5" color="yellow"></a-box>
                  </a-entity>
                );
              })}
            </a-scene>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeARPage() {
  return (
    <Suspense fallback={<div className='bg-black w-full h-full text-white flex items-center justify-center'>エンジンを起動中...</div>}>
      <HomeAR />
    </Suspense>
  );
}