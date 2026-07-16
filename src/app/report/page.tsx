'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const playSound = (type: 'tap') => {
  const audio = new Audio(`/sounds/${type}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

function ReportPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [isClient, setIsClient] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [hallOfFameCount, setHallOfFameCount] = useState(0);
  const [walkDistance, setWalkDistance] = useState(0);
  const [feedCount, setFeedCount] = useState(0);
  const [landmarkVisitCount, setLandmarkVisitCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [mindfulnessLogCount, setMindfulnessLogCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [affection, setAffection] = useState(0);
  const [motivationPercent, setMotivationPercent] = useState(100);

  const stepCount = Math.floor(walkDistance / 0.75);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    const initAuthAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setSessionUserId(session.user.id);
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (profile) setHallOfFameCount(profile.hall_of_fame_count || 0);
      setIsAuthChecking(false);
    };
    initAuthAndProfile();
  }, [supabase, router]);

  useEffect(() => {
    const fetchGameData = async () => {
      if (!sessionUserId) return;

      const { data: pet } = await supabase.from('pets')
        .select(`id, affection_level, walk_distance_m, level, is_deceased, sleeping_until, last_fed_at`)
        .eq('owner_id', sessionUserId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (pet && !pet.is_deceased) {
        setAffection(pet.affection_level || 0); 
        setWalkDistance(pet.walk_distance_m || 0); 
        setLevel(pet.level || 1);

        const now = new Date().getTime();
        const lastFedTime = pet.last_fed_at ? new Date(pet.last_fed_at).getTime() : now;
        const hoursPassed = (now - lastFedTime) / (1000 * 60 * 60);
        let calculatedHunger = 100 - (hoursPassed / 24) * 100;
        const isSleeping = pet.sleeping_until ? new Date(pet.sleeping_until) > new Date() : false;
        if (isSleeping) calculatedHunger = Math.max(calculatedHunger, 50);
        const finalHunger = Math.max(0, Math.min(100, Math.floor(calculatedHunger)));
        
        let baseMotivation = 50 + ((pet.affection_level || 0) * 2);
        if (finalHunger < 50 && !isSleeping) baseMotivation -= (50 - finalHunger) * 2;
        if (isSleeping) baseMotivation = 100;
        setMotivationPercent(Math.max(0, Math.min(100, Math.floor(baseMotivation))));

        const { count: feedLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'feed');
        if (feedLogCount !== null) setFeedCount(feedLogCount);
        const { count: eventLogCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'event');
        if (eventLogCount !== null) setEventCount(eventLogCount);
        const { count: mindCount } = await supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('action_type', 'mindfulness');
        if (mindCount !== null) setMindfulnessLogCount(mindCount);
        const { count: landmarkCount } = await supabase.from('landmark_visits').select('id', { count: 'exact', head: true }).eq('user_id', sessionUserId);
        if (landmarkCount !== null) setLandmarkVisitCount(landmarkCount);
      }
      setIsDataLoaded(true);
    };
    fetchGameData();
  }, [sessionUserId, supabase]);

  if (!isClient || isAuthChecking || (sessionUserId && !isDataLoaded)) {
    return (
      <div className="bg-black w-full h-full flex flex-col items-center justify-center text-white fixed inset-0 z-[9999]">
        <div className="w-10 h-10 border-4 border-gray-500 border-t-white rounded-full animate-spin mb-4"></div>
        <p className="font-bold">データ読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black text-white overflow-hidden">
      <div className="absolute inset-0 z-30 overflow-y-auto pb-32 pt-10 px-6 backdrop-blur-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-purple-400">📊 育成とマインドフルネスの記録</h2>
        <div className="space-y-6">
          <div className="bg-gray-800 p-5 rounded-2xl border border-purple-500/30 shadow-lg">
            <h3 className="font-bold text-xl mb-3 border-b border-gray-600 pb-2">🏃 ウォーキング記録</h3>
            <p className="text-4xl font-black text-cyan-400">{Math.floor(walkDistance)} <span className="text-sm font-normal text-gray-300">m</span></p>
            <p className="text-md text-gray-400 mt-1">推定歩数: 約 {stepCount} 歩</p>
          </div>

          <div className="bg-gray-800 p-5 rounded-2xl border border-teal-500/30 shadow-lg">
            <h3 className="font-bold text-xl mb-3 border-b border-gray-600 pb-2">🧘 マインドフルネス記録</h3>
            <p className="text-4xl font-black text-teal-400">{mindfulnessLogCount} <span className="text-sm font-normal text-gray-300">回 実行</span></p>
            <p className="text-md text-gray-400 mt-1">心の平穏とペットへの愛情度が記録されています。</p>
            
            <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-gray-700 p-3 rounded-xl text-center shadow-inner">
                    <div className="text-xs text-gray-400">現在の愛情度</div>
                    <div className="text-xl font-bold text-pink-400">💖 {Math.floor(affection)}</div>
                </div>
                <div className="bg-gray-700 p-3 rounded-xl text-center shadow-inner">
                    <div className="text-xs text-gray-400">ごきげん</div>
                    <div className="text-xl font-bold text-orange-400">✨ {motivationPercent}%</div>
                </div>
            </div>
          </div>

          <div className="bg-gray-800 p-5 rounded-2xl border border-yellow-500/30 shadow-lg">
            <h3 className="font-bold text-xl mb-3 border-b border-gray-600 pb-2">📋 アクティビティ総数</h3>
            <ul className="space-y-3 text-gray-300">
                <li className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                  <span>殿堂入り達成</span> <span className="font-bold text-yellow-400 text-lg">🏆 {hallOfFameCount} 回</span>
                </li>
                <li className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                  <span>ごはんをあげた回数</span> <span className="font-bold text-lg">🍚 {feedCount} 回</span>
                </li>
                <li className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                  <span>スポットを訪れた回数</span> <span className="font-bold text-lg">📍 {landmarkVisitCount} 回</span>
                </li>
                <li className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                  <span>なでた回数</span> <span className="font-bold text-lg">✨ {eventCount} 回</span>
                </li>
                <li className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                  <span>現在のレベル</span> <span className="font-bold text-yellow-400 text-lg">🌟 Lv. {level}</span>
                </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 🌟 ページ遷移用ナビゲーション（フルリロード） */}
      <div className="absolute z-40 bottom-0 w-full p-4 flex flex-col gap-4 pointer-events-auto">
        <div className="flex justify-around bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
          <button onClick={() => { playSound('tap'); window.location.href = '/home'; }} className="font-bold flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"><span className="text-xl">🏠</span><span className="text-xs">おうち</span></button>
          <button onClick={() => { playSound('tap'); window.location.href = '/walk'; }} className="font-bold flex flex-col items-center gap-1 text-gray-400 hover:text-green-600 transition-colors"><span className="text-xl">🚶</span><span className="text-xs">さんぽ</span></button>
          <button onClick={() => { playSound('tap'); window.location.href = '/report'; }} className="font-bold flex flex-col items-center gap-1 text-purple-600"><span className="text-xl">📊</span><span className="text-xs">きろく</span></button>
        </div>
      </div>
    </div>
  );
}

export default function ReportPageWrapper() {
  return (
    <Suspense fallback={<div className="bg-black w-full h-full text-white flex items-center justify-center">ロード中...</div>}>
      <ReportPage />
    </Suspense>
  );
}