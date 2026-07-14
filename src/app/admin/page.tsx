'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

// Supabaseの公開URLから、Storageのファイルパス（バケット名以降）を抽出するヘルパー関数
const extractFilePath = (url: string | null) => {
  if (!url) return null;
  const parts = url.split('/ar_assets/');
  return parts.length > 1 ? parts[1] : null;
};

// 全国ランダム配置用の座標ジェネレーター（おおよその日本領域）
const generateRandomSpots = (master: any, count: number, startTime: string, endTime: string) => {
  const spots = [];
  for (let i = 0; i < count; i++) {
    // 緯度: 約31.0 ~ 45.0, 経度: 約130.0 ~ 145.0
    const lat = 31.0 + Math.random() * (45.0 - 31.0);
    const lng = 130.0 + Math.random() * (145.0 - 130.0);
    spots.push({
      master_id: master.id,
      name: master.name,
      description: master.description,
      radius_meters: master.radius_meters,
      bonus_points: master.bonus_points,
      model_url: master.model_url,
      latitude: lat,
      longitude: lng,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      end_time: endTime ? new Date(endTime).toISOString() : null
    });
  }
  return spots;
};

export default function AdminDashboard() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'pets' | 'landmarks' | 'items' | 'coupons' | 'drops' | 'news' | 'users' | 'settings'>('pets');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 登録済みデータ一覧用のState ---
  const [petsList, setPetsList] = useState<any[]>([]);
  const [landmarkMastersList, setLandmarkMastersList] = useState<any[]>([]); // スポットリスト用
  const [landmarksList, setLandmarksList] = useState<any[]>([]);             // 実体のスポット用
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [couponsList, setCouponsList] = useState<any[]>([]);                 // クーポン用
  const [newsList, setNewsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userPetsList, setUserPetsList] = useState<any[]>([]);               // ユーザーが保有するペット(状態異常管理用)
  const [facilityDropsList, setFacilityDropsList] = useState<any[]>([]);     // 施設別ドロップ報酬リスト
  const [raritiesList, setRaritiesList] = useState<any[]>([]);
  const [attributesList, setAttributesList] = useState<any[]>([]);

  // --- ペット用State ---
  const [petName, setPetName] = useState('');
  const [petEggType, setPetEggType] = useState('A'); 
  const [petRarity, setPetRarity] = useState('N');
  const [petWeight, setPetWeight] = useState('100');
  const [petModelFile, setPetModelFile] = useState<File | null>(null);         
  const [petModelV2File, setPetModelV2File] = useState<File | null>(null);     
  const [petModelV3File, setPetModelV3File] = useState<File | null>(null);     
  const [petMarkerFile, setPetMarkerFile] = useState<File | null>(null);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<number[]>([]);
  const [editingPetId, setEditingPetId] = useState<number | null>(null);
  
  // --- 設定用State: レアリティ / 属性 ---
  const [newRarityCode, setNewRarityCode] = useState('');
  const [newRarityLabel, setNewRarityLabel] = useState('');
  const [newRarityColor, setNewRarityColor] = useState('#ffffff');
  const [newRarityWeight, setNewRarityWeight] = useState('100'); // 🌟 レアリティの排出ウェイト
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeDesc, setNewAttributeDesc] = useState('');

  // --- ランドマーク用State ---
  const [landmarkInputMode, setLandmarkInputMode] = useState<'master' | 'manual'>('master');
  
  // 1. スポットマスター（リスト）作成用
  const [lmMasterName, setLmMasterName] = useState('');
  const [lmMasterDesc, setLmMasterDesc] = useState('');
  const [lmMasterFacilityType, setLmMasterFacilityType] = useState('normal');
  const [lmMasterRadius, setLmMasterRadius] = useState('50');
  const [lmMasterPoints, setLmMasterPoints] = useState('100');
  const [lmMasterIsPublic, setLmMasterIsPublic] = useState(false);
  const [lmMasterModelFile, setLmMasterModelFile] = useState<File | null>(null);
  
  // 大量発生設定用
  const [lmAutoGenerate, setLmAutoGenerate] = useState(false);
  const [lmGenCount, setLmGenCount] = useState('100');
  const [lmGenStartTime, setLmGenStartTime] = useState('');
  const [lmGenEndTime, setLmGenEndTime] = useState('');
  const [activeMassGenMaster, setActiveMassGenMaster] = useState<any | null>(null);

  // 2. 個別配置用
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
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);

  // --- クーポン用State ---
  const [couponName, setCouponName] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponQrFile, setCouponQrFile] = useState<File | null>(null);

  // --- 施設別ドロップ報酬用State ---
  const [dropFacilityType, setDropFacilityType] = useState('restaurant');
  const [dropRewardType, setDropRewardType] = useState('item'); // 'item' or 'coupon'
  const [dropItemId, setDropItemId] = useState('');
  const [dropCouponId, setDropCouponId] = useState('');
  const [dropAmount, setDropAmount] = useState('1');
  const [dropRate, setDropRate] = useState('100');

  // --- お知らせ用State ---
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');

  // --- データの取得（一覧表示用） ---
  const fetchData = async () => {
    const [
      petsRes, 
      landmarkMastersRes,
      landmarksRes, 
      itemsRes, 
      couponsRes,
      newsRes, 
      usersRes, 
      raritiesRes, 
      attributesRes, 
      petAttrsRes,
      userPetsRes,
      facilityDropsRes
    ] = await Promise.all([
      supabase.from('pet_masters').select('*').order('id', { ascending: false }),
      supabase.from('landmark_masters').select('*').order('id', { ascending: false }),
      supabase.from('landmarks').select('*').order('id', { ascending: false }),
      supabase.from('item_masters').select('*').order('id', { ascending: false }),
      supabase.from('coupon_masters').select('*').order('id', { ascending: false }),
      supabase.from('announcements').select('*').order('published_at', { ascending: false }),
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('rarities').select('*').order('id', { ascending: true }),
      supabase.from('attributes').select('*').order('id', { ascending: true }),
      supabase.from('pet_master_attributes').select('*'),
      supabase.from('pets').select('*, pet_masters(name)').order('created_at', { ascending: false }),
      supabase.from('facility_drop_masters').select('*, item_masters(name, image_url), coupon_masters(name, qr_image_url)').order('id', { ascending: false })
    ]);
    
    if (petsRes.data) {
      const petAttrs = (petAttrsRes && petAttrsRes.data) ? petAttrsRes.data : [];
      const attributes = (attributesRes && attributesRes.data) ? attributesRes.data : [];
      const attrById = new Map<number, any>(attributes.map((a: any) => [a.id, a]));
      const petAttrMap: Record<number, any[]> = {};
      petAttrs.forEach((r: any) => {
        if (!petAttrMap[r.pet_master_id]) petAttrMap[r.pet_master_id] = [];
        const a = attrById.get(r.attribute_id);
        if (a) petAttrMap[r.pet_master_id].push(a);
      });
      setPetsList(petsRes.data.map((p: any) => ({ ...p, attributes: petAttrMap[p.id] || [] })));
    }
    if (landmarkMastersRes.data) setLandmarkMastersList(landmarkMastersRes.data);
    if (landmarksRes.data) setLandmarksList(landmarksRes.data);
    if (itemsRes.data) setItemsList(itemsRes.data);
    if (couponsRes.data) setCouponsList(couponsRes.data);
    if (newsRes.data) setNewsList(newsRes.data);
    if (usersRes.data) setUsersList(usersRes.data);
    if (raritiesRes && raritiesRes.data) setRaritiesList(raritiesRes.data);
    if (attributesRes && attributesRes.data) setAttributesList(attributesRes.data);
    if (userPetsRes.data) setUserPetsList(userPetsRes.data);
    if (facilityDropsRes.data) setFacilityDropsList(facilityDropsRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- レアリティ / 属性: CRUD ハンドラ ---
  const handleAddRarity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRarityCode || !newRarityLabel) return alert('コードとラベルを入力してください');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('rarities').insert({ 
        code: newRarityCode, 
        label: newRarityLabel, 
        color: newRarityColor,
        drop_weight: parseInt(newRarityWeight, 10) // 🌟 ウェイトの保存
      });
      if (error) throw error;
      setNewRarityCode(''); setNewRarityLabel(''); setNewRarityColor('#ffffff'); setNewRarityWeight('100');
      fetchData();
      alert('レアリティを追加しました');
    } catch (e: any) {
      alert(`追加に失敗しました: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🌟 既存レアリティのウェイト更新機能
  const handleUpdateRarityWeight = async (id: number, currentWeight: number) => {
    const newWeightStr = window.prompt('新しい排出ウェイトを入力してください（整数）\n※数値が大きいほど出やすくなります。', String(currentWeight));
    if (newWeightStr === null) return; // キャンセル時
    const newWeight = parseInt(newWeightStr, 10);
    if (isNaN(newWeight) || newWeight < 0) return alert('正しい数値を入力してください');

    try {
      const { error } = await supabase.from('rarities').update({ drop_weight: newWeight }).eq('id', id);
      if (error) throw error;
      fetchData();
      alert('ウェイトを更新しました');
    } catch (e: any) {
      alert(`更新に失敗しました: ${e.message}`);
    }
  };

  const handleDeleteRarity = async (id: number) => {
    if (!window.confirm('このレアリティを削除しますか？既存のペットに影響が出る可能性があります')) return;
    try {
      const { error } = await supabase.from('rarities').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      alert('削除しました');
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  const handleAddAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttributeName) return alert('属性名を入力してください');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('attributes').insert({ name: newAttributeName, description: newAttributeDesc });
      if (error) throw error;
      setNewAttributeName(''); setNewAttributeDesc('');
      fetchData();
      alert('属性を追加しました');
    } catch (e: any) {
      alert(`追加に失敗しました: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttribute = async (id: number) => {
    if (!window.confirm('この属性を削除しますか？')) return;
    try {
      const { error } = await supabase.from('attributes').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      alert('削除しました');
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

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

  const handleSavePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petModelFile || !petMarkerFile || !petName) return alert('必須項目が不足しています（名前、第1形態モデル、マーカー）');
    setIsSubmitting(true);
    try {
      let modelUrl: string | null = null;
      let modelV2Url: string | null = null;
      let modelV3Url: string | null = null;
      let markerUrl: string | null = null;

      if (editingPetId) {
        const { data: existing } = await supabase.from('pet_masters').select('*').eq('id', editingPetId).single();
        modelUrl = existing?.model_url || null;
        modelV2Url = existing?.model_url_v2 || null;
        modelV3Url = existing?.model_url_v3 || null;
        markerUrl = existing?.marker_url || null;
      }

      if (petModelFile) modelUrl = await uploadFile(petModelFile, 'models');
      if (petModelV2File) modelV2Url = await uploadFile(petModelV2File, 'models');
      if (petModelV3File) modelV3Url = await uploadFile(petModelV3File, 'models');
      if (petMarkerFile) markerUrl = await uploadFile(petMarkerFile, 'markers');

      if (editingPetId) {
        const updatePayload: any = {
          name: petName,
          rarity: petRarity,
          egg_type: petEggType, 
          drop_weight: parseInt(petWeight, 10)
        };
        if (modelUrl) updatePayload.model_url = modelUrl;
        if (modelV2Url) updatePayload.model_url_v2 = modelV2Url;
        if (modelV3Url) updatePayload.model_url_v3 = modelV3Url;
        if (markerUrl) updatePayload.marker_url = markerUrl;

        const { error: updateErr } = await supabase.from('pet_masters').update(updatePayload).eq('id', editingPetId);
        if (updateErr) throw updateErr;

        const { error: delErr } = await supabase.from('pet_master_attributes').delete().eq('pet_master_id', editingPetId);
        if (delErr) throw delErr;
        if (selectedAttributeIds && selectedAttributeIds.length > 0) {
          const rels = selectedAttributeIds.map(attrId => ({ pet_master_id: editingPetId, attribute_id: attrId }));
          const { error: relErr } = await supabase.from('pet_master_attributes').insert(rels);
          if (relErr) throw relErr;
        }

        alert(`ペット「${petName}」を更新しました`);
      } else {
        if (!modelUrl || !markerUrl) throw new Error('モデルまたはマーカーのアップロードに失敗しました');
        const { data: insertedPet, error: insertError } = await supabase.from('pet_masters').insert({
          name: petName,
          model_url: modelUrl,
          model_url_v2: modelV2Url,
          model_url_v3: modelV3Url,
          marker_url: markerUrl,
          rarity: petRarity,
          egg_type: petEggType,
          drop_weight: parseInt(petWeight, 10)
        }).select('id').single();
        if (insertError) throw insertError;

        const petMasterId = insertedPet?.id;
        if (petMasterId && selectedAttributeIds && selectedAttributeIds.length > 0) {
          const rels = selectedAttributeIds.map(attrId => ({ pet_master_id: petMasterId, attribute_id: attrId }));
          const { error: relErr } = await supabase.from('pet_master_attributes').insert(rels);
          if (relErr) throw relErr;
        }

        alert(`ペット「${petName}」をガチャのラインナップに登録しました！`);
      }

      setPetName(''); setPetModelFile(null); setPetModelV2File(null); setPetModelV3File(null); setPetMarkerFile(null);
      setPetEggType('A');
      setSelectedAttributeIds([]);
      setEditingPetId(null);
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLandmarkMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lmMasterModelFile || !lmMasterName) return alert('スポット名とモデルが必要です');
    setIsSubmitting(true);
    try {
      const modelUrl = await uploadFile(lmMasterModelFile, 'models');
      const { data: master, error } = await supabase.from('landmark_masters').insert({
        name: lmMasterName,
        description: lmMasterDesc,
        facility_type: lmMasterFacilityType,
        radius_meters: parseInt(lmMasterRadius, 10),
        bonus_points: parseInt(lmMasterPoints, 10),
        model_url: modelUrl,
        is_public: lmMasterIsPublic
      }).select('*').single();
      if (error) throw error;

      if (lmAutoGenerate) {
        const count = parseInt(lmGenCount, 10);
        const spots = generateRandomSpots(master, count, lmGenStartTime, lmGenEndTime);
        const { error: genErr } = await supabase.from('landmarks').insert(spots);
        if (genErr) throw genErr;
        alert(`スポット「${master.name}」をリストに登録し、全国に ${count} 箇所ランダム配置しました！`);
      } else {
        alert(`スポット「${master.name}」をリストに登録しました！`);
      }

      setLmMasterName(''); setLmMasterDesc(''); setLmMasterFacilityType('normal'); setLmMasterModelFile(null); setLmAutoGenerate(false);
      setLmGenStartTime(''); setLmGenEndTime(''); setLmGenCount('100');
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLandmarkManual = async (e: React.FormEvent) => {
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

  const handleExecuteMassGen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMassGenMaster) return;
    setIsSubmitting(true);
    try {
      const count = parseInt(lmGenCount, 10);
      const spots = generateRandomSpots(activeMassGenMaster, count, lmGenStartTime, lmGenEndTime);
      const { error } = await supabase.from('landmarks').insert(spots);
      if (error) throw error;

      alert(`スケジュールを設定し、全国に ${count} 箇所を発生させました！`);
      setActiveMassGenMaster(null);
      setLmGenStartTime(''); setLmGenEndTime(''); setLmGenCount('100');
      fetchData();
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponName) return alert('クーポン名が必要です');
    setIsSubmitting(true);
    try {
      let qrUrl = null;
      if (couponQrFile) {
        qrUrl = await uploadFile(couponQrFile, 'coupons');
      }

      const { error } = await supabase.from('coupon_masters').insert({
        name: couponName,
        description: couponDesc,
        coupon_code: couponCode,
        qr_image_url: qrUrl
      });
      if (error) throw error;

      alert(`クーポン「${couponName}」を登録しました！`);
      setCouponName(''); setCouponDesc(''); setCouponCode(''); setCouponQrFile(null);
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFacilityDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dropRewardType === 'item' && !dropItemId) return alert('アイテムを選択してください');
    if (dropRewardType === 'coupon' && !dropCouponId) return alert('クーポンを選択してください');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('facility_drop_masters').insert({
        facility_type: dropFacilityType,
        reward_type: dropRewardType,
        item_id: dropRewardType === 'item' ? parseInt(dropItemId, 10) : null,
        coupon_id: dropRewardType === 'coupon' ? parseInt(dropCouponId, 10) : null,
        drop_amount: parseInt(dropAmount, 10),
        drop_rate_percent: parseInt(dropRate, 10)
      });
      if (error) throw error;
      alert('ドロップ報酬を設定しました！');
      setDropItemId(''); setDropCouponId(''); setDropAmount('1'); setDropRate('100');
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleUpdatePetCondition = async (petId: string, newCondition: string) => {
    if (!window.confirm(`このペットのステータスを「${newCondition === 'healthy' ? '健康' : newCondition === 'sick' ? '病気' : '飢餓'}」に変更しますか？`)) return;
    try {
      const { error } = await supabase.from('pets').update({ condition_status: newCondition }).eq('id', petId);
      if (error) throw error;
      alert('ステータスを更新しました。');
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    }
  };

  // ==========================================
  //  削除・更新 (Delete / Update) アクション
  // ==========================================

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

  const handleDeleteLandmarkMaster = async (id: number, modelUrl: string) => {
    if (!window.confirm('このスポットリストを削除しますか？\n※既に配置された実体のスポットは削除されません。')) return;
    try {
      const modelPath = extractFilePath(modelUrl);
      if (modelPath) await supabase.storage.from('ar_assets').remove([modelPath]);
      const { error } = await supabase.from('landmark_masters').delete().eq('id', id);
      if (error) throw error;
      alert('スポットリストから削除しました。');
      fetchData();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  const toggleLandmarkMasterPublic = async (id: number, current: boolean) => {
    try {
      const { error } = await supabase.from('landmark_masters').update({ is_public: !current }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    }
  };

  const handleDeleteLandmarkInstance = async (id: number) => {
    if (!window.confirm('この配置済みスポットを削除しますか？')) return;
    try {
      const { error } = await supabase.from('landmarks').delete().eq('id', id);
      if (error) throw error;
      alert('スポットを撤去しました。');
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

  const handleDeleteCoupon = async (id: number, qrUrl: string | null) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      const qrPath = extractFilePath(qrUrl);
      if (qrPath) {
        await supabase.storage.from('ar_assets').remove([qrPath]);
      }
      const { error } = await supabase.from('coupon_masters').delete().eq('id', id);
      if (error) throw error;
      alert('削除しました。');
      fetchData();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  const handleDeleteFacilityDrop = async (id: number) => {
    if (!window.confirm('この報酬設定を削除しますか？')) return;
    try {
      const { error } = await supabase.from('facility_drop_masters').delete().eq('id', id);
      if (error) throw error;
      alert('削除しました。');
      fetchData();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  const toggleNews = async (id: number, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('announcements').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    }
  };

  // ペットリストを卵タイプごとにグループ化
  const groupedPets = petsList.reduce((acc, pet) => {
    const type = pet.egg_type || 'A';
    if (!acc[type]) acc[type] = [];
    acc[type].push(pet);
    return acc;
  }, {} as Record<string, any[]>);
  const eggTypes = Object.keys(groupedPets).sort();

  // レアリティの全体のウェイト合計（表示用）
  const totalRarityWeight = raritiesList.reduce((sum, r) => sum + (r.drop_weight || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow-xl rounded-3xl mt-8 mb-20">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">⚙️ Straid AR 全体管理ダッシュボード</h1>
      
      {/* タブ切り替え */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {(['pets', 'landmarks', 'items', 'coupons', 'drops', 'news', 'users', 'settings'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`px-8 py-3 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {tab === 'pets' && '🐶 ペット管理'}
            {tab === 'landmarks' && '📍 スポット管理'}
            {tab === 'items' && '🛒 アイテム管理'}
            {tab === 'coupons' && '🎫 クーポン管理'}
            {tab === 'drops' && '🎁 報酬設定'}
            {tab === 'news' && '📢 お知らせ管理'}
            {tab === 'users' && '👥 ユーザー/状態管理'}
            {tab === 'settings' && '⚙️ 設定 (レアリティ/属性)'}
          </button>
        ))}
      </div>

      {/* コンテンツエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* === 左・右カラムは「設定」タブ以外の時だけ描画する === */}
        {activeTab !== 'settings' && (
          <>
            {/* --- 左カラム: 登録・サマリー --- */}
            <div>
              {/* 1. ペット追加フォーム */}
              {activeTab === 'pets' && (
                <form onSubmit={handleSavePet} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <h2 className="text-xl font-bold">新規ペット登録</h2>
                  {editingPetId && <div className="text-sm text-yellow-700 mb-2">編集中: ID {editingPetId} — 変更が終わったら保存してください</div>}
                  
                  <div className="flex gap-4">
                    <div className="flex-[2]">
                      <label className="block text-sm font-bold mb-1">ペットの名前</label>
                      <input type="text" value={petName} onChange={e => setPetName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                    </div>
                    <div className="flex-[1]">
                      <label className="block text-sm font-bold mb-1 text-orange-700">属する卵タイプ</label>
                      <select value={petEggType} onChange={e => setPetEggType(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 font-bold bg-orange-50 text-orange-900 border-orange-200">
                        <option value="A">卵 A</option>
                        <option value="B">卵 B</option>
                        <option value="C">卵 C</option>
                        <option value="D">卵 D</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">レアリティ</label>
                      <select value={petRarity} onChange={e => setPetRarity(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500">
                        {raritiesList && raritiesList.length > 0 ? (
                          raritiesList.map(r => (
                            <option key={r.id} value={r.code}>{r.code} {r.label ? `(${r.label})` : ''}</option>
                          ))
                        ) : (
                          <>
                            <option value="N">N (ノーマル)</option>
                            <option value="R">R (レア)</option>
                            <option value="SR">SR (スーパーレア)</option>
                            <option value="UR">UR (激レア)</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">属性 (複数選択可)</label>
                      <div className="w-full border p-3 rounded-lg bg-white max-h-40 overflow-y-auto">
                        {attributesList && attributesList.length > 0 ? (
                          attributesList.map(a => (
                            <label key={a.id} className="flex items-center gap-2 text-sm mb-2">
                              <input type="checkbox" checked={selectedAttributeIds.includes(a.id)} onChange={e => {
                                if (e.target.checked) setSelectedAttributeIds(prev => [...prev, a.id]);
                                else setSelectedAttributeIds(prev => prev.filter(id => id !== a.id));
                              }} />
                              <span>{a.name}{a.description ? ` — ${a.description}` : ''}</span>
                            </label>
                          ))
                        ) : (
                          <div className="text-xs text-gray-500">まだ属性が登録されていません</div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1 text-blue-700">個別ウェイト</label>
                      <input type="number" value={petWeight} onChange={e => setPetWeight(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50" required />
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-blue-900 mb-1">第1形態 3Dモデル (.glb) <span className="text-red-500">*</span></label>
                      <input type="file" accept=".glb" onChange={e => setPetModelFile(e.target.files?.[0] || null)} className="w-full text-sm" required={!editingPetId} />
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
                    <input type="file" accept=".mind" onChange={e => setPetMarkerFile(e.target.files?.[0] || null)} className="w-full text-sm" required={!editingPetId} />
                  </div>

                  <div className="flex gap-3">
                    <button disabled={isSubmitting} className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:bg-gray-400">
                      {isSubmitting ? '処理中...' : (editingPetId ? '変更を保存' : 'ペットを登録')}
                    </button>
                    {editingPetId && (
                      <button type="button" onClick={() => {
                        setEditingPetId(null);
                        setPetName(''); setPetEggType('A'); setPetRarity('N'); setPetWeight('100'); setSelectedAttributeIds([]);
                        setPetModelFile(null); setPetModelV2File(null); setPetModelV3File(null); setPetMarkerFile(null);
                      }} className="bg-gray-200 text-gray-700 font-bold py-4 px-4 rounded-xl">キャンセル</button>
                    )}
                  </div>
                </form>
              )}

              {/* 2. ランドマーク (スポット) 追加フォーム */}
              {activeTab === 'landmarks' && (
                <div className="space-y-4">
                  <div className="flex gap-2 p-1 bg-gray-200 rounded-xl">
                    <button onClick={() => setLandmarkInputMode('master')} className={`flex-1 font-bold text-sm py-2 rounded-lg transition-colors ${landmarkInputMode === 'master' ? 'bg-white shadow' : 'text-gray-500 hover:bg-gray-300'}`}>スポットリストの作成</button>
                    <button onClick={() => setLandmarkInputMode('manual')} className={`flex-1 font-bold text-sm py-2 rounded-lg transition-colors ${landmarkInputMode === 'manual' ? 'bg-white shadow' : 'text-gray-500 hover:bg-gray-300'}`}>手動での個別配置</button>
                  </div>

                  {/* モード1: マスター(リスト)作成 */}
                  {landmarkInputMode === 'master' && (
                    <form onSubmit={handleAddLandmarkMaster} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                      <h2 className="text-xl font-bold">スポットリストの作成</h2>
                      <div className="flex gap-4">
                        <div className="flex-[2]">
                          <label className="block text-sm font-bold mb-1">スポット名 (例: お菓子屋さん)</label>
                          <input type="text" value={lmMasterName} onChange={e => setLmMasterName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                        </div>
                        <div className="flex-[1]">
                          <label className="block text-sm font-bold mb-1 text-teal-700">施設タイプ 🌟</label>
                          <select value={lmMasterFacilityType} onChange={e => setLmMasterFacilityType(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-teal-500 font-bold bg-teal-50 text-teal-900 border-teal-200">
                            <option value="normal">📍 通常スポット</option>
                            <option value="special">🌟 特別スポット</option>
                            <option value="restaurant">🍽️ ご飯屋さん</option>
                            <option value="hospital">🏥 病院 (ドクター)</option>
                            <option value="hotel">🏨 ホテル (休憩所)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">説明</label>
                        <textarea value={lmMasterDesc} onChange={e => setLmMasterDesc(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" rows={2} />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">判定半径(m)</label>
                          <input type="number" value={lmMasterRadius} onChange={e => setLmMasterRadius(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">獲得pt</label>
                          <input type="number" value={lmMasterPoints} onChange={e => setLmMasterPoints(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500" required />
                        </div>
                      </div>

                      <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <label className="block text-sm font-bold text-green-900 mb-2">出現3Dオブジェクト (.glb)</label>
                        <input type="file" accept=".glb" onChange={e => setLmMasterModelFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
                      </div>

                      <div className="flex items-center gap-3 bg-white p-3 border rounded-lg">
                        <label className="text-sm font-bold whitespace-nowrap">公開ステータス:</label>
                        <button type="button" onClick={() => setLmMasterIsPublic(!lmMasterIsPublic)} className={`text-xs font-bold px-3 py-1 rounded-full ${lmMasterIsPublic ? 'bg-green-100 text-green-800' : 'bg-gray-300 text-gray-700'}`}>
                          {lmMasterIsPublic ? '公開 (本番表示)' : '非公開 (準備中)'}
                        </button>
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                        <label className="flex items-center gap-2 font-bold text-sm text-yellow-900 cursor-pointer">
                          <input type="checkbox" checked={lmAutoGenerate} onChange={e => setLmAutoGenerate(e.target.checked)} className="w-4 h-4" />
                          <span>登録と同時に全国ランダム配置（大量発生）を行う</span>
                        </label>
                        {lmAutoGenerate && (
                          <div className="grid grid-cols-3 gap-3 mt-4">
                            <div>
                              <label className="text-xs font-bold mb-1 block">発生数</label>
                              <input type="number" value={lmGenCount} onChange={e => setLmGenCount(e.target.value)} className="w-full border p-2 rounded text-sm" />
                            </div>
                            <div>
                              <label className="text-xs font-bold mb-1 block">開始日時 (任意)</label>
                              <input type="datetime-local" value={lmGenStartTime} onChange={e => setLmGenStartTime(e.target.value)} className="w-full border p-2 rounded text-sm" />
                            </div>
                            <div>
                              <label className="text-xs font-bold mb-1 block">終了日時 (任意)</label>
                              <input type="datetime-local" value={lmGenEndTime} onChange={e => setLmGenEndTime(e.target.value)} className="w-full border p-2 rounded text-sm" />
                            </div>
                          </div>
                        )}
                      </div>

                      <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:bg-gray-400">
                        {isSubmitting ? '処理中...' : 'スポットリストに登録する'}
                      </button>
                    </form>
                  )}

                  {/* モード2: 手動個別配置 */}
                  {landmarkInputMode === 'manual' && (
                    <form onSubmit={handleAddLandmarkManual} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                      <h2 className="text-xl font-bold">スポット個別配置</h2>
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
                        {isSubmitting ? '処理中...' : 'ピンポイントで配置する'}
                      </button>
                    </form>
                  )}
                </div>
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
                        <option value="medicine">薬 (状態異常の回復)</option>
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

              {/* 3.5. 🎫 クーポン追加フォーム */}
              {activeTab === 'coupons' && (
                <form onSubmit={handleAddCoupon} className="space-y-5 bg-teal-50 p-6 rounded-2xl border border-teal-100">
                  <h2 className="text-xl font-bold text-teal-900">🎫 新規クーポン追加</h2>
                  <p className="text-xs text-teal-700 mb-4">オフライン（実店舗）で利用できるクーポンを登録します。<br/>※Supabaseに `coupon_masters` テーブルが必要です。</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-1 text-teal-900">クーポン名</label>
                      <input type="text" value={couponName} onChange={e => setCouponName(e.target.value)} placeholder="例: ドリンク1杯無料クーポン" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-teal-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1 text-teal-900">クーポンの説明</label>
                      <textarea value={couponDesc} onChange={e => setCouponDesc(e.target.value)} placeholder="利用条件などを入力..." className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-teal-500" rows={2} required />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1 text-teal-900">クーポンコード (テキスト)</label>
                      <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="例: SUMMER2026 (任意)" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-teal-200 shadow-sm">
                      <label className="block text-sm font-bold text-teal-900 mb-2">QRコード画像アップロード (任意)</label>
                      <input type="file" accept="image/*" onChange={e => setCouponQrFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                    </div>
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-teal-700 disabled:bg-gray-400">
                    {isSubmitting ? '処理中...' : 'クーポンを登録'}
                  </button>
                </form>
              )}

              {/* 🌟 4. 新規: 施設別ドロップ報酬設定フォーム */}
              {activeTab === 'drops' && (
                <form onSubmit={handleAddFacilityDrop} className="space-y-5 bg-pink-50 p-6 rounded-2xl border border-pink-100">
                  <h2 className="text-xl font-bold text-pink-900">🎁 施設ドロップ報酬の設定</h2>
                  <p className="text-xs text-pink-700 mb-4">特定の施設タイプに訪問した際、どのアイテムやクーポンをドロップさせるかを設定します。</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-1 text-pink-900">対象の施設タイプ</label>
                      <select value={dropFacilityType} onChange={e => setDropFacilityType(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-pink-500">
                        <option value="normal">📍 通常スポット</option>
                        <option value="special">🌟 特別スポット</option>
                        <option value="restaurant">🍽️ ご飯屋さん</option>
                        <option value="hospital">🏥 病院 (ドクター)</option>
                        <option value="hotel">🏨 ホテル (休憩所)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1 text-pink-900">報酬タイプ</label>
                      <div className="flex gap-2 p-1 bg-pink-100 rounded-xl mb-3">
                        <button type="button" onClick={() => setDropRewardType('item')} className={`flex-1 font-bold text-sm py-2 rounded-lg transition-colors ${dropRewardType === 'item' ? 'bg-white shadow text-pink-700' : 'text-pink-600 hover:bg-pink-200'}`}>📦 アイテム</button>
                        <button type="button" onClick={() => setDropRewardType('coupon')} className={`flex-1 font-bold text-sm py-2 rounded-lg transition-colors ${dropRewardType === 'coupon' ? 'bg-white shadow text-pink-700' : 'text-pink-600 hover:bg-pink-200'}`}>🎫 クーポン</button>
                      </div>
                    </div>

                    {dropRewardType === 'item' ? (
                      <div>
                        <label className="block text-sm font-bold mb-1 text-pink-900">ドロップさせるアイテム</label>
                        <select value={dropItemId} onChange={e => setDropItemId(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-pink-500" required>
                          <option value="">アイテムを選択してください</option>
                          {itemsList.map(item => (
                            <option key={item.id} value={item.id}>{item.name} ({item.item_type})</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-bold mb-1 text-pink-900">ドロップさせるクーポン</label>
                        <select value={dropCouponId} onChange={e => setDropCouponId(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-pink-500" required>
                          <option value="">クーポンを選択してください</option>
                          {couponsList.map(coupon => (
                            <option key={coupon.id} value={coupon.id}>{coupon.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-bold mb-1 text-pink-900">ドロップ個数</label>
                        <input type="number" value={dropAmount} onChange={e => setDropAmount(e.target.value)} min="1" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-pink-500" required />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-bold mb-1 text-pink-900">ドロップ確率 (%)</label>
                        <input type="number" value={dropRate} onChange={e => setDropRate(e.target.value)} min="1" max="100" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-pink-500" required />
                      </div>
                    </div>
                  </div>

                  <button disabled={isSubmitting} className="w-full bg-pink-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-pink-700 disabled:bg-gray-400">
                    {isSubmitting ? '処理中...' : '報酬ルールを追加'}
                  </button>
                </form>
              )}

              {/* 5. お知らせ追加フォーム */}
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

              {/* 6. ユーザー属性サマリー */}
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
                  <div className="bg-white p-4 rounded-xl shadow-sm mt-4">
                    <p className="text-xs text-indigo-700 font-bold">💡 右側のリストから、各ユーザーの保有するペットの状態異常（病気・飢餓）を強制的に健康状態へ回復させるなどの救済操作が行えます。</p>
                  </div>
                </div>
              )}
            </div>

            {/* --- 右カラム: 登録済みデータ一覧 --- */}
            <div className="bg-gray-50 border rounded-2xl p-6 h-[800px] overflow-y-auto shadow-inner">
              
              {/* 1. ペット一覧 (卵タイプごとにグルーピング表示) */}
              {activeTab === 'pets' && (
                <>
                  <h2 className="text-xl font-bold mb-6 border-b-2 border-gray-300 pb-2 flex items-center justify-between">
                    <span>🐶 登録済みペット一覧</span>
                    <span className="text-sm font-normal text-gray-500">全 {petsList.length} 匹</span>
                  </h2>

                  {eggTypes.length === 0 && <p className="text-center text-gray-400 py-10 bg-white rounded-xl">データがありません</p>}
                  
                  {eggTypes.map(type => {
                    const petsInEgg: any[] = groupedPets[type];
                    const totalWeight = petsInEgg.reduce((sum, p) => sum + (Number(p.drop_weight) || 0), 0);
                    
                    const weightsByRarity = petsInEgg.reduce((acc: Record<string, number>, p: any) => {
                      const r = p.rarity || 'N';
                      acc[r] = (acc[r] || 0) + (Number(p.drop_weight) || 0);
                      return acc;
                    }, {} as Record<string, number>);

                    return (
                      <div key={type} className="mb-8 bg-white p-5 rounded-2xl shadow-sm border border-orange-100 relative">
                        <div className="absolute top-0 right-0 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                          {petsInEgg.length} 匹
                        </div>
                        <h3 className="font-bold text-xl mb-3 text-orange-900 border-b border-orange-100 pb-2">
                          🥚 卵タイプ: {type}
                        </h3>

                        {/* 💡 個別確率の可視化 */}
                        {totalWeight > 0 ? (
                          <div className="mb-4 bg-orange-50 p-3 rounded-xl border border-orange-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-bold text-orange-900">📊 同一レアリティ内での選出確率</span>
                              <span className="text-xs text-orange-700 ml-auto">総個別ウェイト: {totalWeight}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-bold">
                              {Object.entries(weightsByRarity).map(([r, w]) => {
                                const percentage = ((w / totalWeight) * 100).toFixed(1);
                                return (
                                  <div key={r} className="flex items-center bg-white px-2 py-1 rounded border shadow-sm">
                                    <span className="text-gray-500 mr-1 w-5 text-center">{r}</span>
                                    <span className="text-blue-600">{percentage}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mb-4 text-xs text-red-500">※ウェイトが0のため確率が計算できません</div>
                        )}

                        <div className="space-y-3">
                          {petsInEgg
                            .sort((a, b) => (b.drop_weight || 0) - (a.drop_weight || 0)) 
                            .map(pet => (
                            <div key={pet.id} className="p-4 border rounded-xl hover:bg-gray-50 flex items-center justify-between transition-colors group">
                              <div>
                                <div className="font-bold text-lg flex items-center">
                                  {pet.name} 
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ml-2 border ${
                                    pet.rarity === 'UR' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                                    pet.rarity === 'SR' ? 'bg-red-100 text-red-700 border-red-200' :
                                    pet.rarity === 'R' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-gray-100 text-gray-700 border-gray-200'
                                  }`}>
                                    {pet.rarity}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                  <span className="font-bold text-blue-600 bg-blue-50 px-1.5 rounded border border-blue-100">個別ウェイト: {pet.drop_weight}</span>
                                  <a href={pet.model_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">V1モデル</a>
                                  {pet.model_url_v2 && <a href={pet.model_url_v2} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">V2モデル(Lv5)</a>}
                                  {pet.model_url_v3 && <a href={pet.model_url_v3} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">V3モデル(Lv10)</a>}
                                  <a href={pet.marker_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">マーカー</a>
                                </div>
                                {pet.attributes && pet.attributes.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {pet.attributes.map((a: any) => (
                                      <span key={a.id} className="text-xs px-2 py-1 rounded-full bg-gray-100 border text-gray-700" style={{ background: a.color || undefined }}>{a.name}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => {
                                  setActiveTab('pets');
                                  setEditingPetId(pet.id);
                                  setPetName(pet.name || '');
                                  setPetEggType(pet.egg_type || 'A'); 
                                  setPetRarity(pet.rarity || 'N');
                                  setPetWeight(String(pet.drop_weight || 100));
                                  setSelectedAttributeIds((pet.attributes || []).map((a: any) => a.id));
                                  setPetModelFile(null); setPetModelV2File(null); setPetModelV3File(null); setPetMarkerFile(null);
                                }} className="bg-blue-50 text-blue-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 shadow-sm border border-blue-200">編集</button>
                                <button 
                                  onClick={() => handleDeletePet(pet.id, pet.model_url, pet.marker_url, pet.model_url_v2, pet.model_url_v3)}
                                  className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 shadow-sm border border-red-200"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* 2. ランドマーク一覧 (マスター & 実体) */}
              {activeTab === 'landmarks' && (
                <div className="space-y-8">
                  {/* スポットマスター一覧 */}
                  <div>
                    <h2 className="text-xl font-bold mb-4 border-b pb-2">📂 登録済みスポットリスト (マスター)</h2>
                    <div className="space-y-4">
                      {landmarkMastersList.map(master => (
                        <div key={master.id} className="p-4 border rounded-xl bg-white flex flex-col gap-3 shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-lg flex items-center gap-2">
                                {master.name}
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-teal-50 text-teal-800 border-teal-200">
                                  {master.facility_type === 'special' ? '🌟 特別' : master.facility_type === 'restaurant' ? '🍽️ ご飯' : master.facility_type === 'hospital' ? '🏥 病院' : master.facility_type === 'hotel' ? '🏨 ホテル' : '📍 通常'}
                                </span>
                                <button onClick={() => toggleLandmarkMasterPublic(master.id, master.is_public)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${master.is_public ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-200 text-gray-600 border-gray-300'}`}>
                                  {master.is_public ? '公開中' : '非公開'}
                                </button>
                              </div>
                              <div className="text-sm text-gray-600 my-1">{master.description}</div>
                              <div className="text-xs text-gray-500">半径: {master.radius_meters}m | 獲得pt: {master.bonus_points}</div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setActiveMassGenMaster(master); setLmGenStartTime(''); setLmGenEndTime(''); setLmGenCount('100'); }} className="bg-yellow-100 text-yellow-800 font-bold text-xs px-3 py-1.5 rounded hover:bg-yellow-200 border border-yellow-300 shadow-sm">
                                🚀 大量発生タイム設定
                              </button>
                              <button onClick={() => handleDeleteLandmarkMaster(master.id, master.model_url)} className="bg-red-50 text-red-600 font-bold text-xs px-3 py-1.5 rounded hover:bg-red-100">
                                削除
                              </button>
                            </div>
                          </div>

                          {/* 大量発生インラインフォーム */}
                          {activeMassGenMaster?.id === master.id && (
                            <form onSubmit={handleExecuteMassGen} className="mt-2 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                              <h4 className="font-bold mb-3 text-sm text-yellow-900">🚀 スケジュール・大量発生設定</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <div>
                                  <label className="text-xs font-bold text-gray-700 block mb-1">発生数 (箇所)</label>
                                  <input type="number" value={lmGenCount} onChange={e => setLmGenCount(e.target.value)} className="w-full border p-2 rounded text-sm" required />
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-gray-700 block mb-1">開始日時 (任意)</label>
                                  <input type="datetime-local" value={lmGenStartTime} onChange={e => setLmGenStartTime(e.target.value)} className="w-full border p-2 rounded text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-gray-700 block mb-1">終了日時 (任意)</label>
                                  <input type="datetime-local" value={lmGenEndTime} onChange={e => setLmGenEndTime(e.target.value)} className="w-full border p-2 rounded text-sm" />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setActiveMassGenMaster(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold text-sm">キャンセル</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-yellow-500 text-white rounded font-bold text-sm shadow hover:bg-yellow-600">発生させる！</button>
                              </div>
                            </form>
                          )}
                        </div>
                      ))}
                      {landmarkMastersList.length === 0 && <p className="text-center text-gray-400 py-4">スポットリストはまだありません</p>}
                    </div>
                  </div>

                  {/* 実際の配置スポット一覧 */}
                  <div>
                    <h2 className="text-xl font-bold mb-4 border-b pb-2 mt-8">📍 マップに配置済みスポット (実体)</h2>
                    <div className="space-y-3">
                      {landmarksList.map(spot => (
                        <div key={spot.id} className="p-4 border rounded-xl hover:bg-gray-50 bg-white flex justify-between items-center transition-colors group shadow-sm">
                          <div>
                            <div className="font-bold text-md">{spot.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Lat: {spot.latitude.toFixed(4)} / Lng: {spot.longitude.toFixed(4)}
                            </div>
                            {(spot.start_time || spot.end_time) && (
                              <div className="text-[10px] text-yellow-700 mt-1 bg-yellow-50 inline-block px-2 py-0.5 rounded border border-yellow-200">
                                ⏳ 期間限定: {spot.start_time ? new Date(spot.start_time).toLocaleString() : '指定なし'} 〜 {spot.end_time ? new Date(spot.end_time).toLocaleString() : '指定なし'}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => handleDeleteLandmarkInstance(spot.id)}
                            className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 text-xs border border-red-200"
                          >
                            撤去
                          </button>
                        </div>
                      ))}
                      {landmarksList.length === 0 && <p className="text-center text-gray-400 py-4">配置されているスポットはありません</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. アイテム一覧 */}
              {activeTab === 'items' && (
                <>
                  <h2 className="text-xl font-bold mb-4 border-b pb-2">🛒 登録済みアイテム一覧</h2>
                  <div className="space-y-3">
                    {itemsList.map(item => (
                      <div key={item.id} className="p-4 border rounded-xl bg-white hover:bg-gray-50 flex items-center gap-4 transition-colors group shadow-sm">
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
                          className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 border border-red-200"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                    {itemsList.length === 0 && <p className="text-center text-gray-400 py-10">データがありません</p>}
                  </div>
                </>
              )}

              {/* 3.5 🎫 クーポン一覧 */}
              {activeTab === 'coupons' && (
                <>
                  <h2 className="text-xl font-bold mb-4 border-b pb-2">🎫 登録済みクーポン一覧</h2>
                  <div className="space-y-3">
                    {couponsList.map(coupon => (
                      <div key={coupon.id} className="p-4 border rounded-xl bg-white hover:bg-gray-50 flex items-center gap-4 transition-colors group shadow-sm border-teal-100">
                        {coupon.qr_image_url ? (
                          <img src={coupon.qr_image_url} alt={coupon.name} className="w-16 h-16 object-cover rounded-lg shadow-sm border" />
                        ) : (
                          <div className="w-16 h-16 bg-teal-50 rounded-lg flex items-center justify-center text-2xl border border-teal-200">🎫</div>
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-teal-900">{coupon.name}</span>
                            {coupon.coupon_code && (
                              <span className="text-xs font-bold bg-teal-100 text-teal-800 px-2 py-1 rounded border border-teal-200">Code: {coupon.coupon_code}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{coupon.description}</div>
                        </div>
                        <button 
                          onClick={() => handleDeleteCoupon(coupon.id, coupon.qr_image_url)}
                          className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 border border-red-200"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                    {couponsList.length === 0 && <p className="text-center text-gray-400 py-10">クーポンはまだ登録されていません</p>}
                  </div>
                </>
              )}

              {/* 🌟 4. 新規: 施設別ドロップ報酬一覧 */}
              {activeTab === 'drops' && (
                <>
                  <h2 className="text-xl font-bold mb-4 border-b pb-2 text-pink-900">🎁 登録済みのドロップルール</h2>
                  <div className="space-y-3">
                    {facilityDropsList.map(drop => (
                      <div key={drop.id} className="p-4 border rounded-xl bg-white hover:bg-gray-50 flex items-center gap-4 transition-colors group shadow-sm">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-800">
                              {drop.facility_type === 'special' ? '🌟 特別スポット' : drop.facility_type === 'restaurant' ? '🍽️ ご飯屋さん' : drop.facility_type === 'hospital' ? '🏥 病院' : drop.facility_type === 'hotel' ? '🏨 ホテル' : '📍 通常スポット'}
                            </span>
                            <span className="text-gray-400 font-bold">→</span>
                            <span className="font-bold text-blue-700">
                              {drop.reward_type === 'coupon' 
                                ? `🎫 ${drop.coupon_masters?.name || '不明なクーポン'}` 
                                : `📦 ${drop.item_masters?.name || '不明なアイテム'}`
                              }
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mt-2 flex gap-4">
                            <span className="bg-gray-100 px-2 py-1 rounded">ドロップ数: <span className="font-bold">{drop.drop_amount}個</span></span>
                            <span className="bg-gray-100 px-2 py-1 rounded">確率: <span className="font-bold">{drop.drop_rate_percent}%</span></span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteFacilityDrop(drop.id)}
                          className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 border border-red-200"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                    {facilityDropsList.length === 0 && <p className="text-center text-gray-400 py-10">ドロップ報酬はまだ設定されていません</p>}
                  </div>
                </>
              )}

              {/* 5. お知らせ一覧 */}
              {activeTab === 'news' && (
                <>
                  <h2 className="text-xl font-bold mb-4 border-b pb-2">📢 配信済みお知らせ一覧</h2>
                  <div className="space-y-3">
                    {newsList.map(news => (
                      <div key={news.id} className={`p-4 border rounded-xl shadow-sm transition-colors ${news.is_active ? 'bg-white' : 'bg-gray-100 opacity-75'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg">{news.title}</h3>
                          <button 
                            onClick={() => toggleNews(news.id, news.is_active)} 
                            className={`text-xs font-bold px-3 py-1 rounded-full ${news.is_active ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-300 text-gray-700'}`}
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
                    {newsList.length === 0 && <p className="text-center text-gray-400 py-10">データがありません</p>}
                  </div>
                </>
              )}

              {/* 🌟 6. ユーザー・状態管理 (ユーザー＋ペット表示) */}
              {activeTab === 'users' && (
                <>
                  <h2 className="text-xl font-bold mb-4 border-b pb-2">👥 登録ユーザーとペットの状態</h2>
                  <div className="space-y-4">
                    {usersList.map(user => {
                      const userPets = userPetsList.filter(p => p.owner_id === user.id);
                      
                      return (
                        <div key={user.id} className="p-4 border rounded-xl bg-white shadow-sm flex flex-col gap-3">
                          <div className="flex justify-between items-start border-b pb-2 border-gray-100">
                            <div>
                              <div className="font-bold text-gray-800">
                                ユーザーID: <span className="text-xs font-normal text-gray-500">{user.id}</span>
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {user.birth_year ? `${user.birth_year}年生まれ` : '未設定'} / {user.gender === 'male' ? '男性' : user.gender === 'female' ? '女性' : user.gender === 'other' ? 'その他' : '未設定'}
                              </div>
                            </div>
                            <div className="text-xs font-bold px-3 py-1 bg-gray-50 border rounded text-gray-600">
                              通知: {user.email_notify_news ? 'ON' : 'OFF'}
                            </div>
                          </div>

                          <div className="pl-2 border-l-4 border-indigo-200 space-y-2">
                            {userPets.length > 0 ? (
                              userPets.map(pet => (
                                <div key={pet.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                                  <div>
                                    <div className="text-sm font-bold flex items-center gap-2">
                                      {pet.custom_name || pet.pet_masters?.name || '名無し'}
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                        pet.condition_status === 'sick' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                                        pet.condition_status === 'starving' ? 'bg-red-100 text-red-700 border-red-300' :
                                        'bg-green-100 text-green-700 border-green-300'
                                      }`}>
                                        {pet.condition_status === 'sick' ? '🏥 病気' : pet.condition_status === 'starving' ? '🍽️ 飢餓' : '✨ 健康'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Lv.{pet.level} | 経験値: {pet.exp} | 種類: {pet.pet_masters?.name}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <select 
                                      value={pet.condition_status || 'healthy'} 
                                      onChange={(e) => handleUpdatePetCondition(pet.id, e.target.value)}
                                      className="text-xs border p-1 rounded font-bold"
                                    >
                                      <option value="healthy">健康にする (強制回復)</option>
                                      <option value="sick">病気にする (テスト)</option>
                                      <option value="starving">飢餓にする (テスト)</option>
                                    </select>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-400 py-1">ペットを保有していません（まだ卵を拾っていない等）</div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                    {usersList.length === 0 && <p className="text-center text-gray-400 py-10">データがありません</p>}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* --- 設定タブ: レアリティ / 属性 管理（設定タブ選択時のみ表示） --- */}
        {activeTab === 'settings' && (
          <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100">
            <h2 className="text-xl font-bold mb-4">⚙️ レアリティ / 属性 管理</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* レアリティ管理エリア */}
              <div className="bg-gray-50 p-4 rounded-xl border">
                <h3 className="font-bold mb-3">レアリティを追加</h3>
                <form onSubmit={handleAddRarity} className="space-y-3 bg-white p-4 rounded-lg border shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">コード (例: N, SR)</label>
                      <input value={newRarityCode} onChange={e => setNewRarityCode(e.target.value)} className="w-full border p-2 rounded text-sm" required />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">ラベル (例: ノーマル)</label>
                      <input value={newRarityLabel} onChange={e => setNewRarityLabel(e.target.value)} className="w-full border p-2 rounded text-sm" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-blue-700 block mb-1">基本排出ウェイト 🌟</label>
                      <input type="number" value={newRarityWeight} onChange={e => setNewRarityWeight(e.target.value)} className="w-full border p-2 rounded text-sm bg-blue-50 focus:ring-blue-500" required />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">カラー</label>
                      <input type="color" value={newRarityColor} onChange={e => setNewRarityColor(e.target.value)} className="w-full h-9 p-1 border rounded cursor-pointer" />
                    </div>
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-2 rounded hover:bg-slate-800 shadow mt-2">
                    追加する
                  </button>
                </form>

                <div className="mt-6">
                  <div className="flex justify-between items-end mb-2 border-b pb-2">
                    <h4 className="font-bold text-gray-800">登録済みレアリティ</h4>
                    <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded">総ウェイト: {totalRarityWeight}</span>
                  </div>
                  
                  <div className="space-y-3 mt-3">
                    {raritiesList.length === 0 && <div className="text-sm text-gray-500 text-center py-4 bg-white rounded border">まだ登録されていません</div>}
                    
                    {/* ウェイトが大きい（出やすい）順に並び替えて表示 */}
                    {[...raritiesList].sort((a, b) => (b.drop_weight || 0) - (a.drop_weight || 0)).map(r => {
                      // 🌟 全体のウェイトに対する割合（％）を計算
                      const dropPercentage = totalRarityWeight > 0 ? (((r.drop_weight || 0) / totalRarityWeight) * 100).toFixed(1) : '0.0';

                      return (
                        <div key={r.id} className="bg-white p-3 rounded-lg border shadow-sm group">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div style={{ width: 14, height: 14, background: r.color || '#ddd', borderRadius: '50%' }} />
                              <span className="font-bold text-lg">{r.code}</span>
                              <span className="text-xs text-gray-500">{r.label}</span>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleUpdateRarityWeight(r.id, r.drop_weight || 0)} 
                                className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100"
                              >
                                ウェイト変更
                              </button>
                              <button 
                                onClick={() => handleDeleteRarity(r.id)} 
                                className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                            <span className="font-bold text-gray-700">ウェイト: <span className="text-blue-700 text-base">{r.drop_weight || 0}</span></span>
                            <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                              排出率: {dropPercentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 属性管理エリア */}
              <div className="bg-gray-50 p-4 rounded-xl border">
                <h3 className="font-bold mb-3">属性を追加</h3>
                <form onSubmit={handleAddAttribute} className="space-y-3 bg-white p-4 rounded-lg border shadow-sm">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">属性名</label>
                    <input value={newAttributeName} onChange={e => setNewAttributeName(e.target.value)} className="w-full border p-2 rounded text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">説明 (任意)</label>
                    <input value={newAttributeDesc} onChange={e => setNewAttributeDesc(e.target.value)} className="w-full border p-2 rounded text-sm" />
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-2 rounded hover:bg-slate-800 shadow mt-2">
                    追加する
                  </button>
                </form>

                <div className="mt-6">
                  <h4 className="font-bold mb-2 border-b pb-2 text-gray-800">登録済み属性</h4>
                  <div className="space-y-2 mt-3">
                    {attributesList.length === 0 && <div className="text-sm text-gray-500 text-center py-4 bg-white rounded border">まだ登録されていません</div>}
                    {attributesList.map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
                        <div>
                          <div className="text-sm font-bold text-gray-800">{a.name}</div>
                          {a.description && <div className="text-xs text-gray-500 mt-0.5">{a.description}</div>}
                        </div>
                        <button onClick={() => handleDeleteAttribute(a.id)} className="text-red-600 text-xs font-bold bg-red-50 border border-red-200 px-2 py-1 rounded hover:bg-red-100">
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}