'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

// Supabaseの公開URLから、Storageのファイルパス（バケット名以降）を抽出するヘルパー関数
const extractFilePath = (url: string | null) => {
  if (!url) return null;
  const parts = url.split('/ar_assets/');
  return parts.length > 1 ? parts[1] : null;
};

export default function AdminDashboard() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'pets' | 'landmarks' | 'items' | 'news' | 'users'>('pets');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 登録済みデータ一覧用のState ---
  const [petsList, setPetsList] = useState<any[]>([]);
  const [landmarksList, setLandmarksList] = useState<any[]>([]);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [newsList, setNewsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // --- ペット用State ---
  const [petName, setPetName] = useState('');
  const [petRarity, setPetRarity] = useState('N');
  const [petWeight, setPetWeight] = useState('100');
  const [petModelFile, setPetModelFile] = useState<File | null>(null);         // 第1形態
  const [petModelV2File, setPetModelV2File] = useState<File | null>(null);     // 第2形態(Lv5)
  const [petModelV3File, setPetModelV3File] = useState<File | null>(null);     // 第3形態(Lv10)
  const [petMarkerFile, setPetMarkerFile] = useState<File | null>(null);

  // --- ランドマーク用State ---
  const [landmarkName, setLandmarkName] = useState('');
  const [landmarkDesc, setLandmarkDesc] = useState('');
  const [landmarkLat, setLandmarkLat] = useState('');
  const [landmarkLng, setLandmarkLng] = useState('');
  const [landmarkRadius, setLandmarkRadius] = useState('50');
  const [landmarkPoints, setLandmarkPoints] = useState('100');
  const [landmarkModelFile, setLandmarkModelFile] = useState<File | null>(null);

  // --- アイテム用State ---
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemType, setItemType] = useState('food');
  const [itemPrice, setItemPrice] = useState('100');
  const [itemEffect, setItemEffect] = useState('10');
  const [itemImageFile, setItemImageFile] = useState<File | null>(null); // 画像ファイル

  // --- お知らせ用State ---
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');

  // --- データの取得（一覧表示用） ---
  const fetchData = async () => {
    const [petsRes, landmarksRes, itemsRes, newsRes, usersRes] = await Promise.all([
      supabase.from('pet_masters').select('*').order('id', { ascending: false }),
      supabase.from('landmarks').select('*').order('id', { ascending: false }),
      supabase.from('item_masters').select('*').order('id', { ascending: false }),
      supabase.from('announcements').select('*').order('published_at', { ascending: false }),
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false })
    ]);
    
    if (petsRes.data) setPetsList(petsRes.data);
    if (landmarksRes.data) setLandmarksList(landmarksRes.data);
    if (itemsRes.data) setItemsList(itemsRes.data);
    if (newsRes.data) setNewsList(newsRes.data);
    if (usersRes.data) setUsersList(usersRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- 共通: Storageアップロード関数 ---
  const uploadFile = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('ar_assets').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('ar_assets').getPublicUrl(fileName);
    return publicUrl;
  };

  // ==========================================
  //  追加 (Create) アクション
  // ==========================================

  // --- 1. ペットの総合登録（進化モデル対応） ---
  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petModelFile || !petMarkerFile || !petName) return alert('必須項目が不足しています（名前、第1形態モデル、マーカー）');
    setIsSubmitting(true);
    try {
      // 必須ファイルのアップロード
      const modelUrl = await uploadFile(petModelFile, 'models');
      const markerUrl = await uploadFile(petMarkerFile, 'markers');
      
      // 進化モデルが選択されていればアップロード
      let modelV2Url = null;
      let modelV3Url = null;
      if (petModelV2File) modelV2Url = await uploadFile(petModelV2File, 'models');
      if (petModelV3File) modelV3Url = await uploadFile(petModelV3File, 'models');
      
      const { error } = await supabase.from('pet_masters').insert({
        name: petName,
        model_url: modelUrl,
        model_url_v2: modelV2Url,
        model_url_v3: modelV3Url,
        marker_url: markerUrl,
        rarity: petRarity,
        drop_weight: parseInt(petWeight, 10)
      });
      if (error) throw error;

      alert(`ペット「${petName}」をガチャのラインナップに登録しました！`);
      setPetName(''); setPetModelFile(null); setPetModelV2File(null); setPetModelV3File(null); setPetMarkerFile(null);
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 2. ランドマークの総合登録 ---
  const handleAddLandmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landmarkModelFile || !landmarkName || !landmarkLat || !landmarkLng) return alert('必須項目が不足しています');
    setIsSubmitting(true);
    try {
      const modelUrl = await uploadFile(landmarkModelFile, 'models');

      const { error } = await supabase.from('landmarks').insert({
        name: landmarkName,
        description: landmarkDesc,
        latitude: parseFloat(landmarkLat),
        longitude: parseFloat(landmarkLng),
        radius_meters: parseInt(landmarkRadius, 10),
        bonus_points: parseInt(landmarkPoints, 10),
        model_url: modelUrl
      });
      if (error) throw error;

      alert(`スポット「${landmarkName}」を地図上に設置しました！`);
      setLandmarkName(''); setLandmarkDesc(''); setLandmarkLat(''); setLandmarkLng(''); setLandmarkModelFile(null);
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 3. アイテムの登録（画像アップロード対応） ---
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName) return alert('アイテム名が必要です');
    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (itemImageFile) {
        imageUrl = await uploadFile(itemImageFile, 'items');
      }

      const { error } = await supabase.from('item_masters').insert({
        name: itemName,
        description: itemDesc,
        item_type: itemType,
        price_jpy: parseInt(itemPrice, 10),
        effect_value: parseInt(itemEffect, 10),
        image_url: imageUrl
      });
      if (error) throw error;

      alert(`アイテム「${itemName}」をショップに並べました！`);
      setItemName(''); setItemDesc(''); setItemPrice('100'); setItemEffect('10'); setItemImageFile(null);
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 4. お知らせの配信 ---
  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle || !newsContent) return alert('タイトルと本文が必要です');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: newsTitle,
        content: newsContent
      });
      if (error) throw error;

      alert('お知らせを配信しました！');
      setNewsTitle(''); setNewsContent('');
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  // ==========================================
  //  削除・更新 (Delete / Update) アクション
  // ==========================================

  // --- 進化モデルのURLも受け取って削除する ---
  const handleDeletePet = async (id: number, modelUrl: string, markerUrl: string, modelV2Url?: string, modelV3Url?: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      const filesToRemove = [
        extractFilePath(modelUrl), 
        extractFilePath(markerUrl),
        extractFilePath(modelV2Url || null),
        extractFilePath(modelV3Url || null)
      ].filter(Boolean) as string[];
      
      if (filesToRemove.length > 0) {
        await supabase.storage.from('ar_assets').remove(filesToRemove);
      }
      const { error } = await supabase.from('pet_masters').delete().eq('id', id);
      if (error) throw error;
      alert('削除しました。');
      fetchData();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  const handleDeleteLandmark = async (id: number, modelUrl: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      const modelPath = extractFilePath(modelUrl);
      if (modelPath) {
        await supabase.storage.from('ar_assets').remove([modelPath]);
      }
      const { error } = await supabase.from('landmarks').delete().eq('id', id);
      if (error) throw error;
      alert('削除しました。');
      fetchData();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  const handleDeleteItem = async (id: number, imageUrl: string | null) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      const imagePath = extractFilePath(imageUrl);
      if (imagePath) {
        await supabase.storage.from('ar_assets').remove([imagePath]);
      }
      const { error } = await supabase.from('item_masters').delete().eq('id', id);
      if (error) throw error;
      alert('削除しました。');
      fetchData();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  // お知らせの公開・非公開トグル
  const toggleNews = async (id: number, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('announcements').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    }
  };


  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow-xl rounded-3xl mt-8 mb-20">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">⚙️ Straid AR 全体管理ダッシュボード</h1>
      
      {/* タブ切り替え */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {(['pets', 'landmarks', 'items', 'news', 'users'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`px-8 py-3 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {tab === 'pets' && '🐶 ペット管理'}
            {tab === 'landmarks' && '📍 スポット管理'}
            {tab === 'items' && '🛒 アイテム管理'}
            {tab === 'news' && '📢 お知らせ管理'}
            {tab === 'users' && '👥 ユーザー属性'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* --- 左カラム: 登録・サマリー --- */}
        <div>
          {/* 1. ペット追加フォーム */}
          {activeTab === 'pets' && (
            <form onSubmit={handleAddPet} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <h2 className="text-xl font-bold">新規ペット登録</h2>
              <div>
                <label className="block text-sm font-bold mb-1">ペットの名前</label>
                <input type="text" value={petName} onChange={e => setPetName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">レアリティ</label>
                  <select value={petRarity} onChange={e => setPetRarity(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="N">N (ノーマル)</option>
                    <option value="R">R (レア)</option>
                    <option value="SR">SR (スーパーレア)</option>
                    <option value="UR">UR (激レア)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">排出ウェイト</label>
                  <input type="number" value={petWeight} onChange={e => setPetWeight(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-blue-900 mb-1">第1形態 3Dモデル (.glb) <span className="text-red-500">*</span></label>
                  <input type="file" accept=".glb" onChange={e => setPetModelFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-1">第2形態 (Lv5進化用) <span className="text-xs font-normal">※任意</span></label>
                  <input type="file" accept=".glb" onChange={e => setPetModelV2File(e.target.files?.[0] || null)} className="w-full text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-1">第3形態 (Lv10進化用) <span className="text-xs font-normal">※任意</span></label>
                  <input type="file" accept=".glb" onChange={e => setPetModelV3File(e.target.files?.[0] || null)} className="w-full text-sm" />
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <label className="block text-sm font-bold text-purple-900 mb-2">認識マーカー (.mind) <span className="text-red-500">*</span></label>
                <input type="file" accept=".mind" onChange={e => setPetMarkerFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
              </div>

              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:bg-gray-400">
                {isSubmitting ? '処理中...' : 'ペットを登録'}
              </button>
            </form>
          )}

          {/* 2. ランドマーク追加フォーム */}
          {activeTab === 'landmarks' && (
            <form onSubmit={handleAddLandmark} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <h2 className="text-xl font-bold">新規スポット配置</h2>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">スポット名</label>
                  <input type="text" value={landmarkName} onChange={e => setLandmarkName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">説明</label>
                  <input type="text" value={landmarkDesc} onChange={e => setLandmarkDesc(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">緯度 (Lat)</label>
                  <input type="number" step="0.000001" value={landmarkLat} onChange={e => setLandmarkLat(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">経度 (Lng)</label>
                  <input type="number" step="0.000001" value={landmarkLng} onChange={e => setLandmarkLng(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">判定半径(m)</label>
                  <input type="number" value={landmarkRadius} onChange={e => setLandmarkRadius(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">獲得pt</label>
                  <input type="number" value={landmarkPoints} onChange={e => setLandmarkPoints(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <label className="block text-sm font-bold text-green-900 mb-2">出現3Dオブジェクト (.glb)</label>
                <input type="file" accept=".glb" onChange={e => setLandmarkModelFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
              </div>
              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:bg-gray-400">
                {isSubmitting ? '処理中...' : 'スポットを配置'}
              </button>
            </form>
          )}

          {/* 3. アイテム追加フォーム */}
          {activeTab === 'items' && (
            <form onSubmit={handleAddItem} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <h2 className="text-xl font-bold">新規アイテム追加</h2>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">アイテム名</label>
                  <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-500" required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">種類</label>
                  <select value={itemType} onChange={e => setItemType(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-500">
                    <option value="food">食べ物 (親密度回復)</option>
                    <option value="sleep">睡眠薬 (お世話停止)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">アイテムの説明</label>
                <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-500" rows={2} required />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">価格 (円)</label>
                  <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-500" required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">効果値</label>
                  <input type="number" value={itemEffect} onChange={e => setItemEffect(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-500" required />
                </div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                <label className="block text-sm font-bold text-yellow-900 mb-2">アイテムのアイコン画像 (.png, .jpg)</label>
                <input type="file" accept="image/*" onChange={e => setItemImageFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                <p className="text-xs text-yellow-700 mt-1">※画像がない場合はデフォルトのアイコンになります</p>
              </div>
              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:bg-gray-400">
                {isSubmitting ? '処理中...' : 'アイテムを登録'}
              </button>
            </form>
          )}

          {/* 4. お知らせ追加フォーム */}
          {activeTab === 'news' && (
            <form onSubmit={handleAddNews} className="space-y-5 bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <h2 className="text-xl font-bold text-blue-900">新規お知らせ配信</h2>
              <div>
                <label className="block text-sm font-bold mb-1 text-blue-800">タイトル</label>
                <input type="text" value={newsTitle} onChange={e => setNewsTitle(e.target.value)} placeholder="例: 夏のイベント開催！" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-blue-800">本文</label>
                <textarea value={newsContent} onChange={e => setNewsContent(e.target.value)} placeholder="お知らせの内容を入力..." className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" rows={6} required />
              </div>
              <button disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 disabled:bg-gray-400">
                {isSubmitting ? '処理中...' : '配信する'}
              </button>
            </form>
          )}

          {/* 5. ユーザー属性サマリー */}
          {activeTab === 'users' && (
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 space-y-5">
              <h2 className="text-xl font-bold text-indigo-900">ユーザー属性サマリー</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm text-center">
                  <div className="text-sm text-gray-500 mb-1">総登録ユーザー数</div>
                  <div className="text-3xl font-bold text-indigo-600">{usersList.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm text-center">
                  <div className="text-sm text-gray-500 mb-1">プロフィール設定済</div>
                  <div className="text-3xl font-bold text-indigo-600">{usersList.filter(u => u.birth_year).length}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- 右カラム: 登録済みデータ一覧 --- */}
        <div className="bg-white border rounded-2xl p-6 h-[800px] overflow-y-auto shadow-inner">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">
            {activeTab === 'pets' && '🐶 登録済みペット一覧'}
            {activeTab === 'landmarks' && '📍 配置済みスポット一覧'}
            {activeTab === 'items' && '🛒 登録済みアイテム一覧'}
            {activeTab === 'news' && '📢 配信済みお知らせ一覧'}
            {activeTab === 'users' && '👥 登録ユーザー一覧'}
          </h2>

          <div className="space-y-3">
            {/* 1. ペット一覧 */}
            {activeTab === 'pets' && petsList.map(pet => (
              <div key={pet.id} className="p-4 border rounded-xl hover:bg-gray-50 flex items-center justify-between transition-colors group">
                <div>
                  <div className="font-bold text-lg">{pet.name} <span className="text-sm font-normal bg-gray-200 px-2 py-1 rounded ml-2">ランク: {pet.rarity}</span></div>
                  <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>ウェイト: {pet.drop_weight}</span>
                    <a href={pet.model_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">V1モデル</a>
                    {pet.model_url_v2 && <a href={pet.model_url_v2} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">V2モデル(Lv5)</a>}
                    {pet.model_url_v3 && <a href={pet.model_url_v3} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">V3モデル(Lv10)</a>}
                    <a href={pet.marker_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">マーカー</a>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeletePet(pet.id, pet.model_url, pet.marker_url, pet.model_url_v2, pet.model_url_v3)}
                  className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                >
                  削除
                </button>
              </div>
            ))}

            {/* 2. ランドマーク一覧 */}
            {activeTab === 'landmarks' && landmarksList.map(spot => (
              <div key={spot.id} className="p-4 border rounded-xl hover:bg-gray-50 flex justify-between items-center transition-colors group">
                <div>
                  <div className="font-bold text-lg">{spot.name}</div>
                  <div className="text-sm text-gray-600 my-1">{spot.description}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Lat: {spot.latitude.toFixed(4)} / Lng: {spot.longitude.toFixed(4)} <span className="font-bold text-green-600 ml-2">{spot.bonus_points} pt</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteLandmark(spot.id, spot.model_url)}
                  className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                >
                  削除
                </button>
              </div>
            ))}

            {/* 3. アイテム一覧 */}
            {activeTab === 'items' && itemsList.map(item => (
              <div key={item.id} className="p-4 border rounded-xl hover:bg-gray-50 flex items-center gap-4 transition-colors group">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg shadow-sm border" />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-2xl">📦</div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{item.name}</span>
                    <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{item.item_type}</span>
                    <span className="font-bold text-blue-600 ml-auto">{item.price_jpy > 0 ? `¥${item.price_jpy}` : '無料'}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                  <div className="text-xs text-gray-400 mt-1">効果値: {item.effect_value}</div>
                </div>
                <button 
                  onClick={() => handleDeleteItem(item.id, item.image_url)}
                  className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                >
                  削除
                </button>
              </div>
            ))}

            {/* 4. お知らせ一覧 */}
            {activeTab === 'news' && newsList.map(news => (
              <div key={news.id} className={`p-4 border rounded-xl transition-colors ${news.is_active ? 'bg-white' : 'bg-gray-100 opacity-75'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{news.title}</h3>
                  <button 
                    onClick={() => toggleNews(news.id, news.is_active)} 
                    className={`text-xs font-bold px-3 py-1 rounded-full ${news.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-300 text-gray-700'}`}
                  >
                    {news.is_active ? '配信中' : '非公開'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{news.content}</p>
                <div className="text-[10px] text-gray-400 mt-3 text-right">
                  配信日時: {new Date(news.published_at).toLocaleString()}
                </div>
              </div>
            ))}

            {/* 5. ユーザー属性一覧 */}
            {activeTab === 'users' && usersList.map(user => (
              <div key={user.id} className="p-4 border rounded-xl flex justify-between items-center bg-gray-50">
                <div>
                  <div className="font-bold text-gray-800">
                    ユーザーID: <span className="text-xs font-normal">{user.id.substring(0, 8)}...</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {user.birth_year ? `${user.birth_year}年生まれ` : '未設定'} / {user.gender === 'male' ? '男性' : user.gender === 'female' ? '女性' : user.gender === 'other' ? 'その他' : '未設定'}
                  </div>
                </div>
                <div className="text-xs font-bold px-3 py-1 bg-white border rounded text-gray-600">
                  通知: {user.email_notify_news ? 'ON' : 'OFF'}
                </div>
              </div>
            ))}

            {/* 空の時の表示 */}
            {((activeTab === 'pets' && petsList.length === 0) || 
              (activeTab === 'landmarks' && landmarksList.length === 0) || 
              (activeTab === 'items' && itemsList.length === 0) ||
              (activeTab === 'news' && newsList.length === 0) ||
              (activeTab === 'users' && usersList.length === 0)) && (
              <p className="text-center text-gray-400 py-10">データがありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}