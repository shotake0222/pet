'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ClickerGame } from './games/ClickerGame';
import { PuzzleGame } from './games/PuzzleGame';
import { RhythmGame } from './games/RhythmGame';
import { getUnlockedGames, completeGame, getAvailableSpots } from '@/utils/gameUtils';

interface SpotGameViewProps {
  userId: string;
  spotName?: string;
  spotId?: bigint | null;
  onGameStart?: () => void;
  onGameEnd?: () => void;
  onClose: () => void;
}

/**
 * スポット到着時のゲーム画面マネージャー
 */
export const SpotGameView: React.FC<SpotGameViewProps> = ({ userId, spotName, spotId, onGameStart, onGameEnd, onClose }) => {
  const supabase = createClient();
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // 利用可能なゲーム一覧を取得
  useEffect(() => {
    const loadGames = async () => {
      try {
        const unlockedGames = await getUnlockedGames(userId);
        setGames(unlockedGames);
      } catch (error) {
        console.error('ゲーム読み込みエラー:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, [userId]);

  // ゲームコンポーネントを取得
  const renderGameComponent = (game: any) => {
    switch (game.game_type) {
      case 'clicker':
        return (
          <ClickerGame
            gameId={game.id}
            onComplete={(score) => handleGameComplete(game, score)}
            onCancel={() => {
              onGameEnd?.();
              setSelectedGame(null);
            }}
          />
        );
      case 'puzzle':
        return (
          <PuzzleGame
            gameId={game.id}
            onComplete={(score) => handleGameComplete(game, score)}
            onCancel={() => {
              onGameEnd?.();
              setSelectedGame(null);
            }}
          />
        );
      case 'rhythm':
        return (
          <RhythmGame
            gameId={game.id}
            onComplete={(score) => handleGameComplete(game, score)}
            onCancel={() => {
              onGameEnd?.();
              setSelectedGame(null);
            }}
          />
        );
      default:
        return null;
    }
  };

  const handleGameComplete = async (game: any, score: number) => {
    try {
      await completeGame(userId, game.id, score, spotId || null);
      // ゲーム一覧を再読込
      const unlockedGames = await getUnlockedGames(userId);
      setGames(unlockedGames);
      setSelectedGame(null);
      onGameEnd?.();

      // 成功メッセージ
      setTimeout(() => {
        alert(`${game.title}をクリアしました！スコア: ${score}`);
      }, 500);
    } catch (error) {
      console.error('ゲーム完了エラー:', error);
      onGameEnd?.();
    }
  };

  // ゲーム実行中
  if (selectedGame) {
    return renderGameComponent(selectedGame);
  }

  // ゲーム選択画面
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-sky-100 to-blue-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
        <h1 className="text-2xl font-bold">{spotName || 'スポット'} のゲーム</h1>
        <p className="text-sm opacity-90">クリア数に応じて新しいゲームがアンロック！</p>
      </div>

      {/* ゲーム一覧 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xl text-gray-600">読み込み中...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xl text-gray-600">ゲームがまだアンロックされていません</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((game) => (
              <div
                key={game.id}
                className={`p-6 rounded-lg border-2 transition-all ${
                  game.isUnlocked
                    ? 'bg-white border-blue-300 hover:border-blue-500 hover:shadow-lg cursor-pointer'
                    : 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                }`}
                onClick={() => {
                  if (game.isUnlocked) {
                    onGameStart?.();
                    setSelectedGame(game);
                  }
                }}
              >
                {/* ロックアイコン */}
                {!game.isUnlocked && (
                  <div className="text-4xl mb-2">🔒</div>
                )}

                {/* ゲーム情報 */}
                <h3 className="text-xl font-bold text-gray-800 mb-2">{game.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{game.description}</p>

                {/* ゲーム詳細 */}
                <div className="mb-4 text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">難易度:</span>
                    <span className="font-semibold">
                      {'⭐'.repeat(game.difficulty)}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">クリア数:</span>
                    <span className="font-semibold">{game.progress.clear_count}回</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">ベストスコア:</span>
                    <span className="font-semibold">{game.progress.best_score}</span>
                  </div>
                </div>

                {/* ロック条件 */}
                {!game.isUnlocked && (
                  <p className="text-xs text-orange-600 font-semibold">
                    あと {game.unlocked_by_clear_count - (games.reduce((sum, g) => sum + g.progress.clear_count, 0))} クリアでアンロック
                  </p>
                )}

                {/* ボタン */}
                {game.isUnlocked && (
                  <button className="w-full mt-4 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors">
                    プレイ
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* クローズボタン */}
      <div className="p-6 border-t border-gray-200 bg-white">
        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
        >
          スポットから出発する
        </button>
      </div>
    </div>
  );
};
