'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getAvailableSpots, isUserAtSpot } from '@/utils/gameUtils';
import { isDebugMode } from '@/utils/debugMode';
import { SpotGameView } from './SpotGameView';

interface SpotDetectorProps {
  userId: string;
}

/**
 * スポット到着検出コンポーネント
 * GPS位置をリアルタイム監視してスポット到着を検出
 * デバッグモード時は位置情報チェックをスキップ
 */
export const SpotDetector: React.FC<SpotDetectorProps> = ({ userId }) => {
  const supabase = createClient();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbySpots, setNearbySpots] = useState<any[]>([]);
  const [activeSpot, setActiveSpot] = useState<any | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const [isInSpot, setIsInSpot] = useState(false);
  const [gameInProgress, setGameInProgress] = useState(false); // ゲーム中フラグ
  const [debugMode, setDebugMode] = useState(false);

  // デバッグモード判定
  useEffect(() => {
    setDebugMode(isDebugMode());
  }, []);

  // GPS位置取得
  useEffect(() => {
    // デバッグモード時はダミー位置を設定
    if (debugMode) {
      setUserLocation({ lat: 35.6895, lng: 139.6917 }); // 東京
      setLocationPermission('granted');
      return;
    }

    if (!navigator.geolocation) {
      console.error('このデバイスはGPS機能に対応していません');
      return;
    }

    // 位置情報の許可状態確認
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        setLocationPermission(result.state as any);

        if (result.state === 'granted') {
          startLocationTracking();
        }
      })
      .catch(() => {
        // Permissionsが未対応の環境用フォールバック
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            startLocationTracking();
          },
          (error) => {
            console.error('位置情報取得エラー:', error);
            setLocationPermission('denied');
          }
        );
      });
  }, [debugMode]);

  const startLocationTracking = () => {
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newLocation);
        setLocationPermission('granted');

        // 近くのスポットをチェック
        checkNearbySpots(newLocation);
      },
      (error) => {
        console.error('位置情報追跡エラー:', error);
        setLocationPermission('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  };

  const checkNearbySpots = async (location: { lat: number; lng: number }) => {
    try {
      const spots = await getAvailableSpots(location.lat, location.lng, 5);
      setNearbySpots(spots);

      // ゲーム中は位置情報のチェックをスキップ（画面がちらつくのを防止）
      if (gameInProgress) {
        return;
      }

      // スポット内に居るかチェック
      const spotInside = spots.find(
        (spot) =>
          isUserAtSpot(
            location.lat,
            location.lng,
            Number(spot.latitude),
            Number(spot.longitude),
            spot.radius_meters
          )
      );

      if (spotInside && !isInSpot) {
        setActiveSpot(spotInside);
        setIsInSpot(true);
      } else if (!spotInside && isInSpot && !gameInProgress) {
        setIsInSpot(false);
      }
    } catch (error) {
      console.error('スポット検査エラー:', error);
    }
  };

  // ゲーム画面が表示されている場合
  if (activeSpot && isInSpot) {
    return (
      <SpotGameView
        userId={userId}
        spotName={activeSpot.name}
        spotId={activeSpot.id}
        onGameStart={() => setGameInProgress(true)}
        onGameEnd={() => setGameInProgress(false)}
        onClose={() => {
          setActiveSpot(null);
          setIsInSpot(false);
          setGameInProgress(false);
        }}
      />
    );
  }

  // デバッグ/ステータス表示
  return (
    <div className="p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border border-green-200">
      {/* 位置情報ステータス */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-3 h-3 rounded-full ${
              locationPermission === 'granted' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="font-semibold">
            {locationPermission === 'granted'
              ? '📍 位置情報取得中'
              : '❌ 位置情報がアクセスできません'}
          </span>
        </div>

        {userLocation && (
          <p className="text-sm text-gray-600">
            現在地: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
          </p>
        )}
      </div>

      {/* 近くのスポット一覧 */}
      {nearbySpots.length > 0 && (
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-bold mb-2">近くのスポット ({nearbySpots.length})</h3>
          <ul className="space-y-2">
            {nearbySpots.map((spot) => (
              <li key={spot.id} className="text-sm p-2 bg-blue-50 rounded border border-blue-200">
                <span className="font-semibold">{spot.name}</span>
                <p className="text-xs text-gray-600">{spot.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {locationPermission === 'denied' && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-300 rounded text-sm">
          <p className="font-semibold text-orange-900">位置情報を有効にしてください</p>
          <p className="text-orange-800">ブラウザの設定から位置情報アクセスを許可してください</p>
        </div>
      )}
    </div>
  );
};
