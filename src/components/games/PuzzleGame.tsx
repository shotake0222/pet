'use client';

import { useState, useEffect } from 'react';

interface PuzzleGameProps {
  gameId: bigint;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

interface Tile {
  id: number;
  color: string;
  isMatched: boolean;
}

/**
 * マッチングパズル：同じ色のタイルをマッチさせる
 */
export const PuzzleGame: React.FC<PuzzleGameProps> = ({ gameId, onComplete, onCancel }) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  const gridSize = 4; // 4x4グリッド

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matched, setMatched] = useState(0);
  const [moves, setMoves] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // タイル初期化
  useEffect(() => {
    const newTiles: Tile[] = [];
    const colorPairs = [...colors].sort(() => Math.random() - 0.5);

    for (let i = 0; i < gridSize * gridSize; i++) {
      newTiles.push({
        id: i,
        color: colorPairs[Math.floor(i / 2) % colors.length],
        isMatched: false,
      });
    }

    setTiles(newTiles.sort(() => Math.random() - 0.5));
  }, []);

  // マッチング判定
  useEffect(() => {
    if (selected.length !== 2) return;

    const [first, second] = selected;
    const isMatch = tiles[first].color === tiles[second].color;

    if (isMatch) {
      setTiles((prev) =>
        prev.map((tile, idx) =>
          idx === first || idx === second ? { ...tile, isMatched: true } : tile
        )
      );
      setMatched(matched + 1);
    }

    setSelected([]);
    setMoves(moves + 1);
  }, [selected, tiles, matched, moves]);

  // クリア判定
  useEffect(() => {
    if (tiles.length > 0 && tiles.every((tile) => tile.isMatched)) {
      setGameOver(true);
    }
  }, [tiles]);

  const handleClick = (id: number) => {
    if (tiles[id].isMatched || selected.includes(id) || selected.length === 2) return;
    setSelected([...selected, id]);
  };

  const score = Math.max(0, 100 - moves * 5);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-purple-400 to-purple-600 p-4">
      {/* スタッツ */}
      <div className="text-white text-center mb-8">
        <p className="text-2xl font-bold">マッチング: {matched}/{(gridSize * gridSize) / 2}</p>
        <p className="text-xl">移動回数: {moves}</p>
      </div>

      {/* グリッド */}
      <div
        className="grid gap-2 bg-white rounded-lg p-4"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridAutoRows: '80px',
        }}
      >
        {tiles.map((tile, idx) => (
          <button
            key={tile.id}
            onClick={() => handleClick(idx)}
            className={`rounded-lg font-bold text-2xl transition-all transform ${
              tile.isMatched
                ? 'bg-gray-300 cursor-not-allowed opacity-50'
                : selected.includes(idx)
                  ? 'ring-4 ring-yellow-400 scale-95'
                  : 'hover:scale-105 cursor-pointer'
            }`}
            style={{
              backgroundColor: selected.includes(idx) ? tile.color : '#E0E0E0',
            }}
            disabled={tile.isMatched}
          >
            {selected.includes(idx) && '✓'}
          </button>
        ))}
      </div>

      {/* ゲーム終了画面 */}
      {gameOver && (
        <div className="mt-8 text-center bg-white bg-opacity-95 p-8 rounded-lg">
          <p className="text-3xl font-bold text-purple-600 mb-4">クリア！</p>
          <p className="text-2xl font-bold text-gray-800 mb-2">スコア: {score}</p>
          <p className="text-lg text-gray-600 mb-6">移動: {moves}回</p>
          <div className="flex gap-4">
            <button
              onClick={() => onComplete(score)}
              className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700"
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
