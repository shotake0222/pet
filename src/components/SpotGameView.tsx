'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClickerGame } from './games/ClickerGame';
import { PuzzleGame } from './games/PuzzleGame';
import { RhythmGame } from './games/RhythmGame';
import { getUnlockedGames, completeGame, type FacilityType } from '@/utils/gameUtils';

interface SpotGameViewProps {
  userId: string;
  spotName?: string;
  /** landmarks.id は uuid のため string で受け取る */
  spotId?: string | null;
  /** スポットの施設タイプ。施設限定の報酬抽選に使う */
  facilityType?: FacilityType | null;
  /** デバッグモード時は全ゲームをアンロック状態で表示する */
  isDebugMode?: boolean;
  onGameStart?: () => void;
  onGameEnd?: () => void;
  onClose: () => void;
}

/** 獲得した報酬の表示用データ */
type GrantedReward = {
  type: 'item' | 'coupon';
  name: string;
  image_url?: string | null;
  item_type?: string | null;
  amount: number;
  reward_code?: string;
};

/**
 * スポット到着時のゲーム画面マネージャー
 */
export const SpotGameView: React.FC<SpotGameViewProps> = ({
  userId,
  spotName,
  spotId,
  facilityType = null,
  isDebugMode = false,
  onGameStart,
  onGameEnd,
  onClose,
}) => {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // クリア結果（スコアと獲得報酬）
  const [resultOverlay, setResultOverlay] = useState<{
    gameTitle: string;
    score: number;
    rewards: GrantedReward[];
  } | null>(null);

  // 利用可能なゲーム一覧を取得
  const loadGames = useCallback(async () => {
    try {
      const unlockedGames = await getUnlockedGames(userId, isDebugMode);
      setGames(unlockedGames);
    } catch (error) {
      console.error('ゲーム読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isDebugMode]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const handleGameComplete = async (game: any, score: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 🎁 completeGame は付与された報酬の配列を返す
      const rewards = await completeGame(
        userId,
        Number(game.id),
        score,
        spotId ? String(spotId) : null,
        facilityType
      );

      // ゲーム一覧を再読込（クリア数・アンロック状況を反映）
      await loadGames();
      setSelectedGame(null);
      onGameEnd?.();

      setResultOverlay({
        gameTitle: game.title,
        score,
        rewards: (rewards || []) as GrantedReward[],
      });
    } catch (error) {
      console.error('ゲーム完了エラー:', error);
      setSelectedGame(null);
      onGameEnd?.();
      alert('結果の保存に失敗しました。通信状態を確認してください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ゲームコンポーネントを取得
  const renderGameComponent = (game: any) => {
    const commonProps = {
      gameId: game.id,
      onComplete: (score: number) => handleGameComplete(game, score),
      onCancel: () => {
        onGameEnd?.();
        setSelectedGame(null);
      },
    };

    switch (game.game_type) {
      case 'clicker':
        return <ClickerGame {...commonProps} />;
      case 'puzzle':
        return <PuzzleGame {...commonProps} />;
      case 'rhythm':
        return <RhythmGame {...commonProps} />;
      default:
        // 未実装のゲーム種別が games テーブルに登録されている場合
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8 text-center">
            <div className="text-5xl mb-4">🚧</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">このゲームは準備中です</h2>
            <p className="text-sm text-gray-600 mb-6">
              ゲーム種別「{game.game_type}」に対応するコンポーネントが未実装です。
            </p>
            <button
              onClick={() => {
                onGameEnd?.();
                setSelectedGame(null);
              }}
              className="px-6 py-3 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600"
            >
              戻る
            </button>
          </div>
        );
    }
  };

  // 🎁 クリア結果と獲得報酬の表示
  if (resultOverlay) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-amber-50 to-orange-50 items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md text-center space-y-4">
          <div className="text-5xl animate-bounce">🎉</div>
          <h2 className="text-2xl font-bold text-orange-700">クリア！</h2>
          <p className="text-gray-700">
            <span className="font-bold">{resultOverlay.gameTitle}</span>
            <br />
            スコア: <span className="text-2xl font-black text-orange-600">{resultOverlay.score}</span>
          </p>

          <div className="border-t pt-4">
            {resultOverlay.rewards.length === 0 ? (
              <p className="text-sm text-gray-500">
                今回は報酬が出ませんでした。
                <br />
                また挑戦してみましょう！
              </p>
            ) : (
              <>
                <h3 className="font-bold text-sm text-orange-800 mb-3">
                  🎁 {resultOverlay.rewards.length}個の報酬を獲得！
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {resultOverlay.rewards.map((reward, idx) => (
                    <div
                      key={`${reward.name}-${idx}`}
                      className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-center gap-3 text-left"
                    >
                      {reward.image_url ? (
                        <img src={reward.image_url} alt={reward.name} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                          {reward.type === 'coupon'
                            ? '🎫'
                            : reward.item_type === 'food'
                              ? '🍙'
                              : reward.item_type === 'sleep'
                                ? '💤'
                                : reward.item_type === 'medicine'
                                  ? '💊'
                                  : '📦'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-orange-900 text-sm truncate">{reward.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {reward.type === 'coupon' ? 'クーポン' : 'アイテム'} × {reward.amount}
                        </div>
                        {reward.reward_code && (
                          <div className="text-[10px] font-mono text-teal-700 mt-0.5">
                            コード: {reward.reward_code}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-3">
                  アイテムは「もちもの」から、クーポンは報酬一覧から確認できます。
                </p>
              </>
            )}
          </div>

          <button
            onClick={() => setResultOverlay(null)}
            className="w-full bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            受け取る
          </button>
        </div>
      </div>
    );
  }

  // ゲーム実行中
  if (selectedGame) {
    return renderGameComponent(selectedGame);
  }

  // 累計クリア数（アンロック条件の表示に使う）
  const totalClears = games.reduce((sum, g) => sum + (g.progress?.clear_count || 0), 0);

  // ゲーム選択画面
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-sky-100 to-blue-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
        <h1 className="text-2xl font-bold">{spotName || 'スポット'} のゲーム</h1>
        <p className="text-sm opacity-90">クリア数に応じて新しいゲームがアンロック！</p>
        {isDebugMode && (
          <span className="inline-block mt-2 text-[10px] font-bold bg-red-500 px-2 py-0.5 rounded-full">
            🐞 デバッグモード（全ゲーム解放中）
          </span>
        )}
      </div>

      {/* ゲーム一覧 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xl text-gray-600">読み込み中...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-xl text-gray-600 mb-2">遊べるゲームがありません</p>
            <p className="text-sm text-gray-500">
              管理画面の「🎮 ゲーム管理」からゲームを登録してください。
            </p>
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
                {!game.isUnlocked && <div className="text-4xl mb-2">🔒</div>}

                {/* ゲーム情報 */}
                <h3 className="text-xl font-bold text-gray-800 mb-2">{game.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{game.description}</p>

                {/* ゲーム詳細 */}
                <div className="mb-4 text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">難易度:</span>
                    <span className="font-semibold">{'⭐'.repeat(game.difficulty || 1)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">クリア数:</span>
                    <span className="font-semibold">{game.progress?.clear_count || 0}回</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">ベストスコア:</span>
                    <span className="font-semibold">{game.progress?.best_score || 0}</span>
                  </div>
                </div>

                {/* ロック条件 */}
                {!game.isUnlocked && (
                  <p className="text-xs text-orange-600 font-semibold">
                    あと {Math.max(0, (game.unlocked_by_clear_count || 0) - totalClears)} クリアでアンロック
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
