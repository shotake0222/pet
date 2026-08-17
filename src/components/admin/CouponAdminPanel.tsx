'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import QRCode from 'qrcode';

interface CouponAdminPanelProps {
  onRefresh?: () => void;
}

/**
 * クーポン・報酬管理パネル
 */
export const CouponAdminPanel: React.FC<CouponAdminPanelProps> = ({ onRefresh }) => {
  const supabase = createClient();
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('unused');
  const [qrCodeData, setQrCodeData] = useState<Record<string, string>>({});

  // 報酬一覧を読み込む
  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('game_rewards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRewards(data || []);

      // QRコード生成
      generateQRCodes(data || []);
    } catch (error) {
      console.error('報酬読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCodes = async (rewardList: any[]) => {
    const qrMap: Record<string, string> = {};

    for (const reward of rewardList) {
      try {
        const qrUrl = await QRCode.toDataURL(reward.qr_data);
        qrMap[reward.id] = qrUrl;
      } catch (error) {
        console.error(`QRコード生成エラー (${reward.id}):`, error);
      }
    }

    setQrCodeData(qrMap);
  };

  const getFilteredRewards = () => {
    switch (filter) {
      case 'unused':
        return rewards.filter((r) => !r.is_used);
      case 'used':
        return rewards.filter((r) => r.is_used);
      default:
        return rewards;
    }
  };

  const handleMarkAsUsed = async (rewardId: bigint) => {
    try {
      const { error } = await supabase
        .from('game_rewards')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        })
        .eq('id', rewardId);

      if (error) throw error;
      alert('報酬を使用済みにしました');
      await loadRewards();
      onRefresh?.();
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました');
    }
  };

  const handleDelete = async (rewardId: bigint) => {
    if (!confirm('この報酬を削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('game_rewards')
        .delete()
        .eq('id', rewardId);

      if (error) throw error;
      alert('報酬を削除しました');
      await loadRewards();
      onRefresh?.();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const getRewardTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      coupon: 'bg-blue-100 text-blue-800',
      item: 'bg-green-100 text-green-800',
      points: 'bg-yellow-100 text-yellow-800',
    };
    const labels: Record<string, string> = {
      coupon: 'クーポン',
      item: 'アイテム',
      points: 'ポイント',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[type]}`}>
        {labels[type]}
      </span>
    );
  };

  const filteredRewards = getFilteredRewards();

  return (
    <div className="space-y-6">
      {/* フィルター */}
      <div className="flex gap-2">
        {(['all', 'unused', 'used'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {{
              all: 'すべて',
              unused: '未使用',
              used: '使用済み',
            }[f]}
          </button>
        ))}
      </div>

      {/* 報酬一覧 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">
          クーポン・報酬 ({filteredRewards.length})
        </h3>

        {loading ? (
          <p className="text-gray-600">読み込み中...</p>
        ) : filteredRewards.length === 0 ? (
          <p className="text-gray-600">該当する報酬がありません</p>
        ) : (
          <div className="space-y-4">
            {filteredRewards.map((reward) => {
              const createdAt = new Date(reward.created_at);
              const usedAt = reward.used_at ? new Date(reward.used_at) : null;
              const expiresAt = reward.expires_at ? new Date(reward.expires_at) : null;
              const isExpired = expiresAt && expiresAt < new Date();

              return (
                <div
                  key={reward.id}
                  className={`border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-4 ${
                    reward.is_used ? 'bg-gray-50 opacity-70' : ''
                  } ${isExpired ? 'bg-red-50' : ''}`}
                >
                  {/* QRコード */}
                  <div className="flex flex-col items-center justify-center bg-white border rounded p-3">
                    {qrCodeData[reward.id] ? (
                      <>
                        <img src={qrCodeData[reward.id]} alt="QR" className="w-32 h-32" />
                        <p className="text-xs text-gray-600 mt-2 text-center">{reward.reward_code}</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">QR生成中...</p>
                    )}
                  </div>

                  {/* 詳細情報 */}
                  <div className="md:col-span-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getRewardTypeBadge(reward.reward_type)}
                        {reward.is_used && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
                            使用済み
                          </span>
                        )}
                        {isExpired && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800">
                            期限切れ
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold">{reward.description}</p>

                      <p className="text-xs text-gray-600">
                        <strong>ユーザーID:</strong> {reward.user_id.substring(0, 8)}...
                      </p>

                      <p className="text-xs text-gray-600">
                        <strong>ゲームID:</strong> #{reward.game_id}
                      </p>

                      {reward.reward_value && (
                        <p className="text-xs text-gray-600">
                          <strong>値:</strong> {reward.reward_value}
                        </p>
                      )}

                      <div className="pt-2 border-t text-xs text-gray-500">
                        <p>📅 発行: {createdAt.toLocaleString('ja-JP')}</p>
                        {usedAt && (
                          <p>✅ 使用: {usedAt.toLocaleString('ja-JP')}</p>
                        )}
                        {expiresAt && (
                          <p className={isExpired ? 'text-red-600' : ''}>
                            ⏰ 期限: {expiresAt.toLocaleString('ja-JP')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="flex flex-col gap-2 justify-center">
                    {!reward.is_used && (
                      <>
                        <button
                          onClick={() => handleMarkAsUsed(reward.id)}
                          className="px-4 py-2 bg-green-500 text-white text-sm font-bold rounded hover:bg-green-600"
                        >
                          使用済み
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(reward.id)}
                      className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded hover:bg-red-600"
                    >
                      削除
                    </button>
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
