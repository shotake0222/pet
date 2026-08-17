'use client';

import { useState, useEffect } from 'react';

interface ClickerGameProps {
  gameId: bigint;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

/**
 * クリッカーゲーム：制限時間内にタップ数を競う
 */
export const ClickerGame: React.FC<ClickerGameProps> = ({ gameId, onComplete, onCancel }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isActive, setIsActive] = useState(true);
  const [clickEffect, setClickEffect] = useState<{ x: number; y: number } | null>(null);

  // タイマー
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsActive(false);
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  // ゲーム終了
  useEffect(() => {
    if (!isActive) {
      const timer = setTimeout(() => onComplete(score), 1500);
      return () => clearTimeout(timer);
    }
  }, [isActive, score, onComplete]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setClickEffect({ x, y });
    setScore(score + 1);

    // エフェクト消去
    setTimeout(() => setClickEffect(null), 300);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-blue-400 to-blue-600">
      {/* タイマー */}
      <div className="text-6xl font-bold text-white mb-8">{timeLeft}</div>

      {/* スコア */}
      <div className="text-2xl text-white mb-4">スコア: {score}</div>

      {/* クリッカーエリア */}
      <div
        onClick={handleClick}
        className={`w-64 h-64 rounded-full flex items-center justify-center text-4xl font-bold cursor-pointer transition-transform ${
          isActive
            ? 'bg-yellow-300 hover:bg-yellow-400 active:scale-95'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isActive ? '👆' : '終了！'}

        {/* クリックエフェクト */}
        {clickEffect && (
          <div
            className="absolute text-2xl font-bold animate-ping"
            style={{
              left: `${clickEffect.x}px`,
              top: `${clickEffect.y}px`,
              pointerEvents: 'none',
            }}
          >
            +1
          </div>
        )}
      </div>

      {/* ゲーム終了画面 */}
      {!isActive && (
        <div className="mt-8 text-center">
          <p className="text-white text-2xl mb-4">ゲーム終了！</p>
          <p className="text-white text-4xl font-bold mb-8">{score} 回</p>
          <button
            onClick={() => onCancel()}
            className="px-6 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-200"
          >
            戻る
          </button>
        </div>
      )}
    </div>
  );
};
