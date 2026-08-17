'use client';

import { useState, useEffect } from 'react';

interface RhythmGameProps {
  gameId: bigint;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

interface Note {
  id: number;
  key: 'a' | 's' | 'd' | 'f';
  time: number; // ミリ秒
}

/**
 * リズムゲーム：キーボードのA, S, D, Fキーでノーツをヒット
 */
export const RhythmGame: React.FC<RhythmGameProps> = ({ gameId, onComplete, onCancel }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [gameActive, setGameActive] = useState(true);
  const [hitNotes, setHitNotes] = useState<number[]>([]);
  const totalDuration = 10000; // 10秒

  // ノーツ生成
  useEffect(() => {
    const newNotes: Note[] = [];
    const keys: Array<'a' | 's' | 'd' | 'f'> = ['a', 's', 'd', 'f'];

    for (let i = 0; i < 20; i++) {
      newNotes.push({
        id: i,
        key: keys[Math.floor(Math.random() * 4)],
        time: Math.random() * totalDuration,
      });
    }

    setNotes(newNotes.sort((a, b) => a.time - b.time));
  }, []);

  // ゲームタイマー
  useEffect(() => {
    if (!gameActive) return;

    const timer = setInterval(() => {
      setGameTime((t) => {
        if (t + 16 >= totalDuration) {
          setGameActive(false);
          return totalDuration;
        }
        return t + 16;
      });
    }, 16);

    return () => clearInterval(timer);
  }, [gameActive]);

  // キーボード入力
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameActive) return;

      const key = e.key.toLowerCase() as 'a' | 's' | 'd' | 'f';
      if (!['a', 's', 'd', 'f'].includes(key)) return;

      e.preventDefault();

      // 3秒以内のノートを探す
      const targetNote = notes.find(
        (n) =>
          n.key === key &&
          !hitNotes.includes(n.id) &&
          Math.abs(n.time - gameTime) < 300 // 300ms以内
      );

      if (targetNote) {
        setHitNotes([...hitNotes, targetNote.id]);
        setScore((s) => s + 100);
        setCombo((c) => c + 1);
      } else {
        setCombo(0);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameActive, gameTime, notes, hitNotes]);

  const progressPercent = (gameTime / totalDuration) * 100;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-indigo-600 to-purple-800 p-4">
      {/* UI */}
      <div className="text-white text-center mb-8">
        <p className="text-3xl font-bold">{score}</p>
        <p className="text-xl">コンボ: {combo}</p>
      </div>

      {/* ゲームエリア */}
      <div className="w-full max-w-2xl">
        {/* ノーツレーン */}
        <div className="grid grid-cols-4 gap-4 mb-12">
          {(['a', 's', 'd', 'f'] as const).map((key) => (
            <div key={key} className="flex flex-col items-center gap-2">
              {/* ノーツ落下表示 */}
              <div className="h-96 w-20 bg-white bg-opacity-10 rounded relative overflow-hidden border-2 border-white border-opacity-30">
                {notes
                  .filter((n) => n.key === key && !hitNotes.includes(n.id))
                  .map((note) => {
                    const yPos = (note.time / totalDuration) * 100;
                    return (
                      <div
                        key={note.id}
                        className="absolute w-full h-12 bg-yellow-300 rounded opacity-80 transition-all"
                        style={{
                          top: `${Math.min(yPos, 100)}%`,
                          opacity: yPos > 100 ? 0 : 0.8,
                        }}
                      />
                    );
                  })}

                {/* ヒットライン */}
                <div className="absolute bottom-4 w-full h-1 bg-white border-t-2 border-b-2 border-yellow-400" />
              </div>

              {/* キーボタン */}
              <button className="w-20 h-16 bg-white text-indigo-600 font-bold text-lg rounded-lg hover:bg-yellow-300 transition-all active:scale-95">
                {key.toUpperCase()}
              </button>
            </div>
          ))}
        </div>

        {/* プログレスバー */}
        <div className="w-full bg-white bg-opacity-20 rounded-lg h-2 mb-8">
          <div
            className="bg-yellow-400 h-full rounded-lg transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 終了画面 */}
      {!gameActive && (
        <div className="mt-8 text-center bg-white bg-opacity-95 p-8 rounded-lg">
          <p className="text-3xl font-bold text-indigo-600 mb-4">終了！</p>
          <p className="text-2xl font-bold text-gray-800 mb-2">スコア: {score}</p>
          <p className="text-lg text-gray-600 mb-2">ノーツ命中: {hitNotes.length}/{notes.length}</p>
          <p className="text-lg text-gray-600 mb-6">精度: {((hitNotes.length / notes.length) * 100).toFixed(1)}%</p>
          <div className="flex gap-4">
            <button
              onClick={() => onComplete(score)}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
            >
              完了
            </button>
            <button
              onClick={() => onCancel()}
              className="px-6 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400"
            >
              戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
