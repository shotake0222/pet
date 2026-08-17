'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  getAllSpots,
  createSpot,
  updateSpot,
  deleteSpot,
  getSpotStatus,
} from '@/utils/spotManagementUtils';

interface SpotAdminPanelProps {
  onRefresh?: () => void;
}

/**
 * スポット管理パネル
 */
export const SpotAdminPanel: React.FC<SpotAdminPanelProps> = ({ onRefresh }) => {
  const supabase = createClient();
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<bigint | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: 35.6762,
    longitude: 139.7674,
    radius_meters: 100,
    start_date: '',
    end_date: '',
    is_limited_time: false,
  });

  // スポット一覧を読み込む
  useEffect(() => {
    loadSpots();
  }, []);

  const loadSpots = async () => {
    try {
      setLoading(true);
      const data = await getAllSpots();
      setSpots(data);
    } catch (error) {
      console.error('スポット読み込みエラー:', error);
      alert('スポットの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      latitude: 35.6762,
      longitude: 139.7674,
      radius_meters: 100,
      start_date: '',
      end_date: '',
      is_limited_time: false,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.description) {
      alert('名前と説明は必須です');
      return;
    }

    try {
      if (editingId) {
        // 更新
        await updateSpot(editingId, {
          name: formData.name,
          description: formData.description,
          latitude: formData.latitude,
          longitude: formData.longitude,
          radius_meters: formData.radius_meters,
          start_date: formData.start_date ? new Date(formData.start_date) : undefined,
          end_date: formData.end_date ? new Date(formData.end_date) : undefined,
          is_limited_time: formData.is_limited_time,
        });
        alert('スポットを更新しました');
      } else {
        // 新規作成
        await createSpot({
          name: formData.name,
          description: formData.description,
          latitude: formData.latitude,
          longitude: formData.longitude,
          radius_meters: formData.radius_meters,
          start_date: formData.start_date ? new Date(formData.start_date) : new Date(),
          end_date: formData.end_date ? new Date(formData.end_date) : undefined,
          is_limited_time: formData.is_limited_time,
        });
        alert('スポットを作成しました');
      }

      resetForm();
      await loadSpots();
      onRefresh?.();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  const handleEdit = (spot: any) => {
    setFormData({
      name: spot.name,
      description: spot.description,
      latitude: spot.latitude,
      longitude: spot.longitude,
      radius_meters: spot.radius_meters,
      start_date: spot.start_date ? new Date(spot.start_date).toISOString().split('T')[0] : '',
      end_date: spot.end_date ? new Date(spot.end_date).toISOString().split('T')[0] : '',
      is_limited_time: spot.is_limited_time,
    });
    setEditingId(spot.id);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id: bigint) => {
    if (!confirm('このスポットを削除してもよろしいですか？')) return;

    try {
      await deleteSpot(id);
      alert('スポットを削除しました');
      await loadSpots();
      onRefresh?.();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      active: '有効',
      pending: '予定',
      inactive: '無効',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* フォーム */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">
          {editingId ? '🔧 スポットを編集' : '➕ 新しいスポットを追加'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">スポット名 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例：東京駅"
                className="w-full border rounded-lg p-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">検出半径（メートル）</label>
              <input
                type="number"
                value={formData.radius_meters}
                onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) })}
                className="w-full border rounded-lg p-3"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">説明 *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="例：東京の玄関口"
              rows={3}
              className="w-full border rounded-lg p-3"
            />
          </div>

          {/* 位置情報 */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-semibold mb-2">緯度</label>
              <input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                className="w-full border rounded-lg p-3"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">経度</label>
              <input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                className="w-full border rounded-lg p-3"
              />
            </div>
          </div>

          {/* 期間設定 */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={formData.is_limited_time}
                onChange={(e) => setFormData({ ...formData, is_limited_time: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="font-semibold">期間限定スポット</span>
            </label>

            {formData.is_limited_time && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-semibold mb-2">開始日時</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">終了日時</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border rounded-lg p-3"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700"
            >
              {editingId ? '更新' : '作成'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 bg-gray-300 text-gray-800 font-bold py-2 rounded-lg hover:bg-gray-400"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>

      {/* スポット一覧 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">登録済みスポット ({spots.length})</h3>

        {loading ? (
          <p className="text-gray-600">読み込み中...</p>
        ) : spots.length === 0 ? (
          <p className="text-gray-600">スポットがまだ登録されていません</p>
        ) : (
          <div className="space-y-3">
            {spots.map((spot) => {
              const status = getSpotStatus(spot);
              const startDate = spot.start_date ? new Date(spot.start_date) : null;
              const endDate = spot.end_date ? new Date(spot.end_date) : null;

              return (
                <div key={spot.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-lg">{spot.name}</h4>
                        {getStatusBadge(status)}
                        {spot.is_limited_time && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            期間限定
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 text-sm mb-2">{spot.description}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                        <div>
                          📍 {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)}
                        </div>
                        <div>📏 半径 {spot.radius_meters}m</div>
                        {startDate && (
                          <div>
                            ▶️ {startDate.toLocaleString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                        {endDate && (
                          <div>
                            ⏹️ {endDate.toLocaleString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(spot)}
                        className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded hover:bg-blue-600"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(spot.id)}
                        className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded hover:bg-red-600"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
