'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getUserCoupons, useCoupon } from '@/utils/spotManagementUtils';
import QRCode from 'qrcode';

interface UserCouponViewProps {
  userId: string;
}

/**
 * ユーザー側：クーポン・報酬表示画面
 */
export const UserCouponView: React.FC<UserCouponViewProps> = ({ userId }) => {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoupon, setSelectedCoupon] = useState<any | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'expired'>('valid');

  useEffect(() => {
    loadCoupons();
  }, [userId]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await getUserCoupons(userId);
      setCoupons(data);
    } catch (error) {
      console.error('クーポン読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (coupon: any) => {
    try {
      const qr = await QRCode.toDataURL(coupon.qr_data);
      setQrCode(qr);
      setSelectedCoupon(coupon);
    } catch (error) {
      console.error('QR生成エラー:', error);
    }
  };

  const handleUseCoupon = async () => {
    if (!selectedCoupon) return;

    try {
      await useCoupon(selectedCoupon.id);
      alert('クーポンを使用しました！');
      setSelectedCoupon(null);
      setQrCode(null);
      await loadCoupons();
    } catch (error) {
      console.error('使用エラー:', error);
      alert('クーポンの使用に失敗しました');
    }
  };

  const getFilteredCoupons = () => {
    const now = new Date();

    switch (filter) {
      case 'valid':
        return coupons.filter((c) => {
          const expiresAt = c.expires_at ? new Date(c.expires_at) : null;
          return !c.is_used && (!expiresAt || expiresAt > now);
        });
      case 'expired':
        return coupons.filter((c) => {
          const expiresAt = c.expires_at ? new Date(c.expires_at) : null;
          return !c.is_used && expiresAt && expiresAt <= now;
        });
      default:
        return coupons;
    }
  };

  const filteredCoupons = getFilteredCoupons();

  if (selectedCoupon && qrCode) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-blue-50 to-purple-50">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <h2 className="text-2xl font-bold">🎁 クーポン</h2>
          <p className="text-sm opacity-90">このQRコードを店舗でスキャンしてください</p>
        </div>

        {/* QRコード表示 */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="bg-white rounded-lg p-8 shadow-lg">
            {qrCode && (
              <img src={qrCode} alt="QR Code" className="w-48 h-48" />
            )}
            <p className="text-center text-sm text-gray-600 mt-4">{selectedCoupon.reward_code}</p>
          </div>

          {/* 詳細情報 */}
          <div className="mt-8 bg-white rounded-lg p-6 w-full max-w-md shadow-md">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">説明</p>
                <p className="font-bold">{selectedCoupon.description}</p>
              </div>

              {selectedCoupon.reward_value && (
                <div>
                  <p className="text-xs text-gray-500">報酬値</p>
                  <p className="font-bold">{selectedCoupon.reward_value}</p>
                </div>
              )}

              {selectedCoupon.expires_at && (
                <div>
                  <p className="text-xs text-gray-500">有効期限</p>
                  <p className="font-bold text-orange-600">
                    {new Date(selectedCoupon.expires_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              )}

              {selectedCoupon.is_used && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-red-800 font-bold">✓ 使用済み</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="p-6 border-t border-gray-200 bg-white space-y-2">
          {!selectedCoupon.is_used && (
            <button
              onClick={handleUseCoupon}
              className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700"
            >
              このクーポンを使用
            </button>
          )}
          <button
            onClick={() => {
              setSelectedCoupon(null);
              setQrCode(null);
            }}
            className="w-full py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-50 to-purple-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <h2 className="text-2xl font-bold">🎁 マイクーポン</h2>
        <p className="text-sm opacity-90">ゲームをクリアして報酬をゲット！</p>
      </div>

      {/* フィルター */}
      <div className="p-4 flex gap-2 border-b border-gray-200 bg-white">
        {(['all', 'valid', 'expired'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {
              {
                all: 'すべて',
                valid: '有効',
                expired: '期限切れ',
              }[f]
            }
          </button>
        ))}
      </div>

      {/* クーポン一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-xl text-gray-600 mb-4">クーポンがありません</p>
            <p className="text-sm text-gray-500">
              {filter === 'valid'
                ? 'ゲームをクリアして報酬をゲットしましょう！'
                : 'クーポンを確認できません'}
            </p>
          </div>
        ) : (
          filteredCoupons.map((coupon) => {
            const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;
            const isExpired = expiresAt && expiresAt < new Date();

            return (
              <div
                key={coupon.id}
                className={`bg-white rounded-lg p-4 border-2 transition-all ${
                  isExpired
                    ? 'border-red-200 opacity-60'
                    : 'border-blue-200 hover:border-blue-400 hover:shadow-lg cursor-pointer'
                }`}
                onClick={() => !isExpired && !coupon.is_used && generateQRCode(coupon)}
              >
                <div className="flex items-start gap-3">
                  {/* アイコン */}
                  <div className="text-3xl">
                    {coupon.is_used ? '✓' : isExpired ? '⏰' : '🎁'}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{coupon.description}</h3>
                    <p className="text-sm text-gray-600 mb-2">{coupon.reward_code}</p>

                    <div className="flex flex-wrap gap-2 mb-2">
                      {coupon.is_used && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          使用済み
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          期限切れ
                        </span>
                      )}
                    </div>

                    {expiresAt && (
                      <p className={`text-xs ${isExpired ? 'text-red-600' : 'text-gray-500'}`}>
                        期限: {expiresAt.toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>

                  {/* 矢印 */}
                  {!isExpired && !coupon.is_used && (
                    <div className="text-blue-600 text-xl">→</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
