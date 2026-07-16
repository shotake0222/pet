/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  const [affinitiesList, setAffinitiesList] = useState<any[]>([]);           // 🌟 追加: 属性とアイテムの相性リスト

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
      facilityDropsRes,
      affinitiesRes // 🌟 追加: 相性データ
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
      supabase.from('facility_drop_masters').select('*, item_masters(name, image_url), coupon_masters(name, qr_image_url)').order('id', { ascending: false }),
      supabase.from('attribute_item_affinities').select('*, item_masters(name)').order('id', { ascending: true }) // 🌟 追加
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
    if (affinitiesRes && affinitiesRes.data) setAffinitiesList(affinitiesRes.data); // 🌟 追加
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      const { error } = await supabase.from('attributes').insert({ name: newAttributeName });
      if (error) throw error;
      setNewAttributeName(''); 
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

  // 🌟 新規: 属性のアイテム相性を追加
  const handleAddAffinity = async (attributeId: number, itemId: string, affinityType: string) => {
    if (!itemId) return alert('アイテムを選択してください');
    try {
      const { error } = await supabase.from('attribute_item_affinities').insert({
        attribute_id: attributeId,
        item_id: parseInt(itemId, 10),
        affinity_type: affinityType
      });
      if (error) throw error;
      fetchData();
      alert('相性を設定しました');
    } catch (e: any) {
      if (e.code === '23505') {
        alert('このアイテムは既に相性設定がされています');
      } else {
        alert(`エラー: ${e.message}`);
      }
    }
  };

  // 🌟 新規: 属性のアイテム相性を削除
  const handleDeleteAffinity = async (affinityId: number) => {
    if (!window.confirm('相性設定を削除しますか？')) return;
    try {
      const { error } = await supabase.from('attribute_item_affinities').delete().eq('id', affinityId);
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
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
                      <label className="block text-sm font-bold mb-1">排出ウェイト (卵内確率)</label>
                      <input type="number" value={petWeight} onChange={e => setPetWeight(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      <p className="text-xs text-gray-500 mt-1">※大きいほど出やすい</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1">属性を選択（複数可）</label>
                    <div className="flex flex-wrap gap-2">
                      {attributesList.map(attr => (
                        <label key={attr.id} className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-gray-200 text-sm cursor-pointer hover:bg-gray-50">
                          <input 
                            type="checkbox" 
                            checked={selectedAttributeIds.includes(attr.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAttributeIds(prev => [...prev, attr.id]);
                              else setSelectedAttributeIds(prev => prev.filter(id => id !== attr.id));
                            }}
                          />
                          {attr.name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 border-t">
                    <h3 className="font-bold text-sm text-gray-600">3Dモデルファイル (.glb)</h3>
                    <div>
                      <label className="block text-sm mb-1">第1形態 (必須)</label>
                      <input type="file" accept=".glb" onChange={e => setPetModelFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">第2形態 (任意)</label>
                      <input type="file" accept=".glb" onChange={e => setPetModelV2File(e.target.files?.[0] || null)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">第3形態 (任意)</label>
                      <input type="file" accept=".glb" onChange={e => setPetModelV3File(e.target.files?.[0] || null)} className="w-full text-sm" />
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <label className="block text-sm font-bold mb-1">ARマーカー用画像 (.patt) 必須</label>
                    <input type="file" accept=".patt" onChange={e => setPetMarkerFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 mt-4">
                    {isSubmitting ? '処理中...' : editingPetId ? '更新する' : '登録する'}
                  </button>
                  {editingPetId && (
                    <button type="button" onClick={() => {
                      setEditingPetId(null); setPetName(''); setPetModelFile(null); setPetModelV2File(null); setPetModelV3File(null); setPetMarkerFile(null); setSelectedAttributeIds([]);
                    }} className="w-full text-sm text-gray-500 mt-2 hover:underline">
                      編集をキャンセル
                    </button>
                  )}
                </form>
              )}

              {/* 2. スポット追加フォーム */}
              {activeTab === 'landmarks' && (
                <div className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <div className="flex gap-2 mb-4 bg-gray-200 p-1 rounded-xl">
                    <button 
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${landmarkInputMode === 'master' ? 'bg-white shadow' : 'text-gray-500 hover:bg-gray-300'}`}
                      onClick={() => setLandmarkInputMode('master')}
                    >
                      スポットリスト登録
                    </button>
                    <button 
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${landmarkInputMode === 'manual' ? 'bg-white shadow' : 'text-gray-500 hover:bg-gray-300'}`}
                      onClick={() => setLandmarkInputMode('manual')}
                    >
                      個別配置（緯度経度）
                    </button>
                  </div>

                  {landmarkInputMode === 'master' ? (
                    <form onSubmit={handleAddLandmarkMaster} className="space-y-4">
                      <h2 className="text-xl font-bold">スポットリストの新規登録</h2>
                      <p className="text-sm text-gray-500">ここで登録したスポットは、後から全国に一斉配置したり、特定の場所に配置したりできます。</p>
                      
                      <div>
                        <label className="block text-sm font-bold mb-1">スポット名</label>
                        <input type="text" value={lmMasterName} onChange={e => setLmMasterName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">説明</label>
                        <textarea value={lmMasterDesc} onChange={e => setLmMasterDesc(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">施設タイプ</label>
                          <select value={lmMasterFacilityType} onChange={e => setLmMasterFacilityType(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <option value="normal">通常</option>
                            <option value="restaurant">飲食店</option>
                            <option value="park">公園</option>
                            <option value="shop">店舗</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">ボーナスポイント</label>
                          <input type="number" value={lmMasterPoints} onChange={e => setLmMasterPoints(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">反応半径 (メートル)</label>
                        <input type="number" value={lmMasterRadius} onChange={e => setLmMasterRadius(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">3Dモデル (.glb)</label>
                        <input type="file" accept=".glb" onChange={e => setLmMasterModelFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <input type="checkbox" id="is_public" checked={lmMasterIsPublic} onChange={e => setLmMasterIsPublic(e.target.checked)} className="w-5 h-5" />
                        <label htmlFor="is_public" className="text-sm font-bold">有効化（ユーザーのマップに表示する）</label>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                        <label className="flex items-center gap-2 font-bold text-blue-900 mb-2 cursor-pointer">
                          <input type="checkbox" checked={lmAutoGenerate} onChange={e => setLmAutoGenerate(e.target.checked)} className="w-4 h-4 text-blue-600" />
                          登録と同時に全国ランダム配置を実行する
                        </label>
                        {lmAutoGenerate && (
                          <div className="space-y-3 mt-3 pl-6">
                            <div>
                              <label className="block text-sm font-bold mb-1">発生数</label>
                              <input type="number" value={lmGenCount} onChange={e => setLmGenCount(e.target.value)} className="w-full border p-2 rounded-lg" required />
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="block text-sm font-bold mb-1">開始日時 (任意)</label>
                                <input type="datetime-local" value={lmGenStartTime} onChange={e => setLmGenStartTime(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
                              </div>
                              <div className="flex-1">
                                <label className="block text-sm font-bold mb-1">終了日時 (任意)</label>
                                <input type="datetime-local" value={lmGenEndTime} onChange={e => setLmGenEndTime(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
                              </div>
                            </div>
                            <p className="text-xs text-blue-700 mt-1">※日時は空欄にすると常設になります。</p>
                          </div>
                        )}
                      </div>

                      <button disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 mt-4">
                        {isSubmitting ? '処理中...' : 'スポットリストに登録する'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleAddLandmarkManual} className="space-y-4">
                      <h2 className="text-xl font-bold">個別スポットの配置</h2>
                      <div>
                        <label className="block text-sm font-bold mb-1">スポット名</label>
                        <input type="text" value={landmarkName} onChange={e => setLandmarkName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">緯度 (Latitude)</label>
                          <input type="text" value={landmarkLat} onChange={e => setLandmarkLat(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required placeholder="例: 35.6895" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">経度 (Longitude)</label>
                          <input type="text" value={landmarkLng} onChange={e => setLandmarkLng(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required placeholder="例: 139.6917" />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">反応半径 (m)</label>
                          <input type="number" value={landmarkRadius} onChange={e => setLandmarkRadius(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold mb-1">ボーナスポイント</label>
                          <input type="number" value={landmarkPoints} onChange={e => setLandmarkPoints(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">3Dモデル (.glb)</label>
                        <input type="file" accept=".glb" onChange={e => setLandmarkModelFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
                      </div>
                      <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 mt-4">
                        {isSubmitting ? '処理中...' : 'マップに配置する'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* 3. アイテム追加フォーム */}
              {activeTab === 'items' && (
                <form onSubmit={handleAddItem} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <h2 className="text-xl font-bold">新規アイテム登録</h2>
                  <div>
                    <label className="block text-sm font-bold mb-1">アイテム名</label>
                    <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full border p-3 rounded-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">説明</label>
                    <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} className="w-full border p-3 rounded-lg" rows={2} />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">種類</label>
                      <select value={itemType} onChange={e => setItemType(e.target.value)} className="w-full border p-3 rounded-lg">
                        <option value="food">食べ物</option>
                        <option value="medicine">薬</option>
                        <option value="toy">おもちゃ</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">効果値</label>
                      <input type="number" value={itemEffect} onChange={e => setItemEffect(e.target.value)} className="w-full border p-3 rounded-lg" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">価格 (円)</label>
                    <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="w-full border p-3 rounded-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">画像 (任意)</label>
                    <input type="file" accept="image/*" onChange={e => setItemImageFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 mt-4">
                    {isSubmitting ? '処理中...' : '登録する'}
                  </button>
                </form>
              )}

              {/* 4. クーポン追加フォーム */}
              {activeTab === 'coupons' && (
                <form onSubmit={handleAddCoupon} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <h2 className="text-xl font-bold">新規クーポン登録</h2>
                  <div>
                    <label className="block text-sm font-bold mb-1">クーポン名</label>
                    <input type="text" value={couponName} onChange={e => setCouponName(e.target.value)} className="w-full border p-3 rounded-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">説明</label>
                    <textarea value={couponDesc} onChange={e => setCouponDesc(e.target.value)} className="w-full border p-3 rounded-lg" rows={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">クーポンコード (任意・テキスト用)</label>
                    <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} className="w-full border p-3 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">QRコード画像 (任意)</label>
                    <input type="file" accept="image/*" onChange={e => setCouponQrFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 mt-4">
                    {isSubmitting ? '処理中...' : '登録する'}
                  </button>
                </form>
              )}

              {/* 5. 施設ドロップ報酬設定フォーム */}
              {activeTab === 'drops' && (
                <form onSubmit={handleAddFacilityDrop} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <h2 className="text-xl font-bold">施設別ドロップ報酬設定</h2>
                  <div>
                    <label className="block text-sm font-bold mb-1">施設タイプ</label>
                    <select value={dropFacilityType} onChange={e => setDropFacilityType(e.target.value)} className="w-full border p-3 rounded-lg">
                      <option value="restaurant">飲食店</option>
                      <option value="park">公園</option>
                      <option value="shop">店舗</option>
                      <option value="normal">通常</option>
                    </select>
                  </div>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="rewardType" value="item" checked={dropRewardType === 'item'} onChange={() => setDropRewardType('item')} />
                      アイテム
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="rewardType" value="coupon" checked={dropRewardType === 'coupon'} onChange={() => setDropRewardType('coupon')} />
                      クーポン
                    </label>
                  </div>

                  {dropRewardType === 'item' ? (
                    <div>
                      <label className="block text-sm font-bold mb-1">付与するアイテム</label>
                      <select value={dropItemId} onChange={e => setDropItemId(e.target.value)} className="w-full border p-3 rounded-lg">
                        <option value="">選択してください</option>
                        {itemsList.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-bold mb-1">付与するクーポン</label>
                      <select value={dropCouponId} onChange={e => setDropCouponId(e.target.value)} className="w-full border p-3 rounded-lg">
                        <option value="">選択してください</option>
                        {couponsList.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">個数</label>
                      <input type="number" value={dropAmount} onChange={e => setDropAmount(e.target.value)} className="w-full border p-3 rounded-lg" required />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">ドロップ確率 (%)</label>
                      <input type="number" value={dropRate} onChange={e => setDropRate(e.target.value)} className="w-full border p-3 rounded-lg" max="100" required />
                    </div>
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 mt-4">
                    {isSubmitting ? '処理中...' : '報酬を設定する'}
                  </button>
                </form>
              )}

              {/* 6. お知らせ追加フォーム */}
              {activeTab === 'news' && (
                <form onSubmit={handleAddNews} className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <h2 className="text-xl font-bold">新規お知らせ配信</h2>
                  <div>
                    <label className="block text-sm font-bold mb-1">タイトル</label>
                    <input type="text" value={newsTitle} onChange={e => setNewsTitle(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">本文</label>
                    <textarea value={newsContent} onChange={e => setNewsContent(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" rows={5} required />
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 mt-4">
                    {isSubmitting ? '配信中...' : '配信する'}
                  </button>
                </form>
              )}

              {/* 7. ユーザー管理 (サマリー) */}
              {activeTab === 'users' && (
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <h2 className="text-xl font-bold mb-4">ユーザー統計</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                      <div className="text-sm text-gray-500">総ユーザー数</div>
                      <div className="text-3xl font-bold">{usersList.length}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                      <div className="text-sm text-gray-500">育成中のペット総数</div>
                      <div className="text-3xl font-bold">{userPetsList.length}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- 右カラム: リスト表示 --- */}
            <div>
              {/* ペット一覧 */}
              {activeTab === 'pets' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="text-xl font-bold mb-6">登録済みペット一覧</h2>
                  {eggTypes.map(eggType => (
                    <div key={eggType} className="mb-8">
                      <h3 className="text-lg font-bold border-b pb-2 mb-4 text-orange-800">🥚 卵タイプ {eggType}</h3>
                      <div className="space-y-4">
                        {groupedPets[eggType].map(pet => (
                          <div key={pet.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg">{pet.name}</span>
                                <span className="text-xs px-2 py-1 bg-gray-200 rounded text-gray-700 font-bold">{pet.rarity}</span>
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded font-bold">ウェイト: {pet.drop_weight || 100}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                {pet.attributes && pet.attributes.length > 0 ? pet.attributes.map((a:any) => <span key={a.id} className="bg-gray-200 px-1 rounded">{a.name}</span>) : <span>属性なし</span>}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 space-x-2">
                                {pet.model_url && <span>✔️ 第1形態</span>}
                                {pet.model_url_v2 && <span>✔️ 第2形態</span>}
                                {pet.model_url_v3 && <span>✔️ 第3形態</span>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => {
                                setEditingPetId(pet.id);
                                setPetName(pet.name);
                                setPetRarity(pet.rarity || 'N');
                                setPetEggType(pet.egg_type || 'A');
                                setPetWeight(String(pet.drop_weight || 100));
                                setSelectedAttributeIds(pet.attributes ? pet.attributes.map((a:any) => a.id) : []);
                                window.scrollTo(0, 0);
                              }} className="text-blue-500 hover:text-blue-700 px-3 py-1 bg-blue-50 rounded-lg text-sm font-bold">
                                編集
                              </button>
                              <button onClick={() => handleDeletePet(pet.id, pet.model_url, pet.marker_url, pet.model_url_v2, pet.model_url_v3)} className="text-red-500 hover:text-red-700 px-3 py-1 bg-red-50 rounded-lg text-sm font-bold">
                                削除
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {petsList.length === 0 && <p className="text-gray-500">まだ登録されていません。</p>}
                </div>
              )}

              {/* ランドマークマスター＆インスタンス一覧 */}
              {activeTab === 'landmarks' && (
                <div className="space-y-8">
                  {/* スポットリスト（マスター） */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-xl font-bold mb-4">スポットリスト（マスター）</h2>
                    <div className="space-y-4">
                      {landmarkMastersList.map(master => (
                        <div key={master.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-bold text-lg">{master.name}</div>
                              <div className="text-sm text-gray-500">タイプ: {master.facility_type} | ポイント: {master.bonus_points} | 半径: {master.radius_meters}m</div>
                            </div>
                            <button onClick={() => handleDeleteLandmarkMaster(master.id, master.model_url)} className="text-red-500 hover:text-red-700 text-sm font-bold px-2 py-1 bg-red-50 rounded">削除</button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <button 
                              onClick={() => toggleLandmarkMasterPublic(master.id, master.is_public)}
                              className={`px-3 py-1 rounded text-sm font-bold ${master.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                            >
                              {master.is_public ? '✅ マップで有効' : '❌ マップで無効'}
                            </button>

                            <button 
                              onClick={() => {
                                setActiveMassGenMaster(master);
                                setLmAutoGenerate(true);
                                setLandmarkInputMode('master');
                                window.scrollTo(0, 0);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-bold bg-blue-50 px-3 py-1 rounded"
                            >
                              大量発生を設定...
                            </button>
                          </div>

                          {/* アクティブなマスターに対する大量発生UI */}
                          {activeMassGenMaster?.id === master.id && (
                            <form onSubmit={handleExecuteMassGen} className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                              <h4 className="font-bold text-blue-900 mb-2">「{master.name}」を大量発生させる</h4>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-sm font-bold mb-1">発生数</label>
                                  <input type="number" value={lmGenCount} onChange={e => setLmGenCount(e.target.value)} className="w-full border p-2 rounded-lg" required />
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="block text-sm font-bold mb-1">開始日時 (任意)</label>
                                    <input type="datetime-local" value={lmGenStartTime} onChange={e => setLmGenStartTime(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-sm font-bold mb-1">終了日時 (任意)</label>
                                    <input type="datetime-local" value={lmGenEndTime} onChange={e => setLmGenEndTime(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                                    実行
                                  </button>
                                  <button type="button" onClick={() => setActiveMassGenMaster(null)} className="flex-1 bg-gray-300 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-400">
                                    キャンセル
                                  </button>
                                </div>
                              </div>
                            </form>
                          )}
                        </div>
                      ))}
                      {landmarkMastersList.length === 0 && <p className="text-gray-500">まだ登録されていません。</p>}
                    </div>
                  </div>

                  {/* 設置済みスポット */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold">マップ上のスポット</h2>
                      <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">計 {landmarksList.length} 箇所</div>
                    </div>
                    <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                      {landmarksList.map(lm => {
                        const isScheduled = lm.start_time || lm.end_time;
                        const now = new Date();
                        let status = 'active';
                        if (lm.start_time && new Date(lm.start_time) > now) status = 'waiting';
                        if (lm.end_time && new Date(lm.end_time) < now) status = 'ended';

                        return (
                          <div key={lm.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                            <div className="overflow-hidden">
                              <div className="font-bold flex items-center gap-2">
                                <span className="truncate">{lm.name}</span>
                                {isScheduled && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                                    status === 'ended' ? 'bg-gray-200 text-gray-600' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {status === 'waiting' ? '待機中' : status === 'ended' ? '終了' : '出現中'}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate">Lat: {lm.latitude.toFixed(4)}, Lng: {lm.longitude.toFixed(4)}</div>
                            </div>
                            <button onClick={() => handleDeleteLandmarkInstance(lm.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 bg-red-50 rounded ml-2 whitespace-nowrap">撤去</button>
                          </div>
                        )
                      })}
                      {landmarksList.length === 0 && <p className="text-gray-500 text-sm">マップ上にスポットはありません。</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* アイテム一覧 */}
              {activeTab === 'items' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="text-xl font-bold mb-4">登録済みアイテム一覧</h2>
                  <div className="space-y-4">
                    {itemsList.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded bg-white border" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">No Img</div>
                          )}
                          <div>
                            <div className="font-bold">{item.name}</div>
                            <div className="text-xs text-gray-500">タイプ: {item.item_type} | 価格: ¥{item.price_jpy} | 効果: {item.effect_value}</div>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteItem(item.id, item.image_url)} className="text-red-500 hover:text-red-700 text-sm font-bold px-3 py-1 bg-red-50 rounded-lg">削除</button>
                      </div>
                    ))}
                    {itemsList.length === 0 && <p className="text-gray-500">まだ登録されていません。</p>}
                  </div>
                </div>
              )}

              {/* クーポン一覧 */}
              {activeTab === 'coupons' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="text-xl font-bold mb-4">登録済みクーポン一覧</h2>
                  <div className="space-y-4">
                    {couponsList.map(coupon => (
                      <div key={coupon.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border">
                        <div className="flex items-center gap-3">
                          {coupon.qr_image_url ? (
                            <img src={coupon.qr_image_url} alt="QR" className="w-10 h-10 object-cover rounded border bg-white" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">No QR</div>
                          )}
                          <div>
                            <div className="font-bold">{coupon.name}</div>
                            {coupon.coupon_code && <div className="text-xs text-blue-600 font-mono bg-blue-50 inline-block px-1 rounded mt-1">{coupon.coupon_code}</div>}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteCoupon(coupon.id, coupon.qr_image_url)} className="text-red-500 hover:text-red-700 text-sm font-bold px-3 py-1 bg-red-50 rounded-lg">削除</button>
                      </div>
                    ))}
                    {couponsList.length === 0 && <p className="text-gray-500">まだ登録されていません。</p>}
                  </div>
                </div>
              )}

              {/* ドロップ報酬一覧 */}
              {activeTab === 'drops' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="text-xl font-bold mb-4">設定済みドロップ報酬</h2>
                  <div className="space-y-4">
                    {facilityDropsList.map(drop => (
                      <div key={drop.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">{drop.facility_type}</span>
                            <span className="text-sm font-bold">{drop.drop_rate_percent}%</span>
                          </div>
                          <div className="text-sm">
                            {drop.reward_type === 'item' ? (
                              <>🎁 {drop.item_masters?.name} × {drop.drop_amount}</>
                            ) : (
                              <>🎫 {drop.coupon_masters?.name} × {drop.drop_amount}</>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteFacilityDrop(drop.id)} className="text-red-500 hover:text-red-700 text-sm font-bold px-3 py-1 bg-red-50 rounded-lg">削除</button>
                      </div>
                    ))}
                    {facilityDropsList.length === 0 && <p className="text-gray-500">まだ設定されていません。</p>}
                  </div>
                </div>
              )}

              {/* お知らせ一覧 */}
              {activeTab === 'news' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="text-xl font-bold mb-4">配信済みお知らせ</h2>
                  <div className="space-y-4">
                    {newsList.map(newsItem => (
                      <div key={newsItem.id} className="p-4 bg-gray-50 rounded-xl border">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg">{newsItem.title}</h3>
                          <button 
                            onClick={() => toggleNews(newsItem.id, newsItem.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-bold ${newsItem.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                          >
                            {newsItem.is_active ? '公開中' : '非公開'}
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{newsItem.content}</p>
                        <div className="text-xs text-gray-400 mt-2">{new Date(newsItem.published_at).toLocaleString()}</div>
                      </div>
                    ))}
                    {newsList.length === 0 && <p className="text-gray-500">まだ配信されていません。</p>}
                  </div>
                </div>
              )}

              {/* ユーザー保有ペット一覧 (状態異常管理) */}
              {activeTab === 'users' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-8">
                  <h2 className="text-xl font-bold mb-4">ペット状態管理</h2>
                  <p className="text-sm text-gray-500 mb-4">ユーザーが保有しているペットの健康状態を強制的に変更できます。（テスト用）</p>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {userPetsList.map(pet => (
                      <div key={pet.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border">
                        <div>
                          <div className="font-bold">{pet.pet_masters?.name} <span className="text-xs text-gray-500 font-normal">({pet.id.substring(0,8)}...)</span></div>
                          <div className="text-xs text-gray-500 mt-1">
                            現在の状態: 
                            <span className={`ml-1 font-bold ${
                              pet.condition_status === 'healthy' ? 'text-green-600' : 
                              pet.condition_status === 'sick' ? 'text-purple-600' : 'text-red-600'
                            }`}>
                              {pet.condition_status === 'healthy' ? '健康' : pet.condition_status === 'sick' ? '病気' : '飢餓'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdatePetCondition(pet.id, 'healthy')} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded font-bold hover:bg-green-200">健康に</button>
                          <button onClick={() => handleUpdatePetCondition(pet.id, 'sick')} className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded font-bold hover:bg-purple-200">病気に</button>
                          <button onClick={() => handleUpdatePetCondition(pet.id, 'hungry')} className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded font-bold hover:bg-red-200">飢餓に</button>
                        </div>
                      </div>
                    ))}
                    {userPetsList.length === 0 && <p className="text-gray-500">まだ保有されているペットがいません。</p>}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* === 「設定」タブの専用レイアウト === */}
        {activeTab === 'settings' && (
          <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* 左: レアリティ設定 */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h2 className="text-xl font-bold mb-4">新規レアリティ追加</h2>
                <form onSubmit={handleAddRarity} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">コード (例: N, R)</label>
                      <input type="text" value={newRarityCode} onChange={e => setNewRarityCode(e.target.value)} className="w-full border p-2 rounded" required />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">ラベル (例: ノーマル)</label>
                      <input type="text" value={newRarityLabel} onChange={e => setNewRarityLabel(e.target.value)} className="w-full border p-2 rounded" required />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">基本排出ウェイト</label>
                      <input type="number" value={newRarityWeight} onChange={e => setNewRarityWeight(e.target.value)} className="w-full border p-2 rounded" required />
                      <p className="text-xs text-gray-500 mt-1">※数値が大きいほど出やすくなります</p>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-1">テーマカラー</label>
                      <input type="color" value={newRarityColor} onChange={e => setNewRarityColor(e.target.value)} className="w-full h-10 p-1 border rounded cursor-pointer" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-slate-800 text-white font-bold py-2 rounded mt-2">追加</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-xl font-bold">登録済みレアリティ</h2>
                  <div className="text-sm text-gray-500">総ウェイト: {totalRarityWeight}</div>
                </div>
                <div className="space-y-2">
                  {raritiesList.map(r => {
                    const probability = totalRarityWeight > 0 ? ((r.drop_weight || 0) / totalRarityWeight * 100).toFixed(1) : 0;
                    return (
                      <div key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: r.color }}></div>
                          <div>
                            <div className="font-bold">{r.code} <span className="text-sm font-normal text-gray-600">({r.label})</span></div>
                            <div className="text-xs text-blue-600 mt-1">
                              ウェイト: {r.drop_weight || 0} (約 {probability}%)
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdateRarityWeight(r.id, r.drop_weight || 0)} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 bg-blue-50 rounded font-bold">ウェイト変更</button>
                          <button onClick={() => handleDeleteRarity(r.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 bg-red-50 rounded font-bold">削除</button>
                        </div>
                      </div>
                    );
                  })}
                  {raritiesList.length === 0 && <p className="text-gray-500 text-sm">登録されていません</p>}
                </div>
              </div>
            </div>

            {/* 右: 属性とアイテム相性の設定 */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h2 className="text-xl font-bold mb-4">新規属性追加</h2>
                <form onSubmit={handleAddAttribute} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">属性名 (例: 火, 水, 機械)</label>
                    <input type="text" value={newAttributeName} onChange={e => setNewAttributeName(e.target.value)} className="w-full border p-2 rounded" required />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-slate-800 text-white font-bold py-2 rounded">追加</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h2 className="text-xl font-bold mb-4">登録済み属性とアイテム相性</h2>
                <div className="space-y-6">
                  {attributesList.map(attr => (
                    <div key={attr.id} className="p-4 bg-gray-50 rounded-xl border">
                      <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <div className="font-bold text-lg">{attr.name}</div>
                        <button onClick={() => handleDeleteAttribute(attr.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 bg-red-50 rounded font-bold">属性を削除</button>
                      </div>
                      
                      {/* 🌟 相性リスト表示 */}
                      <div className="mb-4 space-y-2">
                        <div className="text-sm font-bold text-gray-600 mb-2">アイテム相性設定:</div>
                        {affinitiesList.filter(a => a.attribute_id === attr.id).map(affinity => (
                          <div key={affinity.id} className="flex justify-between items-center bg-white p-2 border rounded text-sm">
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 ${affinity.affinity_type === 'good' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {affinity.affinity_type === 'good' ? '好物 🟢' : '苦手 🔴'}
                              </span>
                              {affinity.item_masters?.name}
                            </div>
                            <button onClick={() => handleDeleteAffinity(affinity.id)} className="text-gray-400 hover:text-red-500">✕</button>
                          </div>
                        ))}
                        {affinitiesList.filter(a => a.attribute_id === attr.id).length === 0 && (
                          <div className="text-xs text-gray-400">相性設定はありません</div>
                        )}
                      </div>

                      {/* 🌟 相性追加フォーム */}
                      <form 
                        className="flex gap-2 mt-2 bg-gray-200 p-2 rounded"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.target as HTMLFormElement;
                          const itemId = (form.elements.namedItem('itemId') as HTMLSelectElement).value;
                          const type = (form.elements.namedItem('affinityType') as HTMLSelectElement).value;
                          handleAddAffinity(attr.id, itemId, type);
                          form.reset();
                        }}
                      >
                        <select name="itemId" className="flex-1 text-sm border rounded p-1" required>
                          <option value="">アイテムを選択...</option>
                          {itemsList.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                        <select name="affinityType" className="w-24 text-sm border rounded p-1">
                          <option value="good">好物 🟢</option>
                          <option value="bad">苦手 🔴</option>
                        </select>
                        <button type="submit" className="bg-slate-800 text-white text-xs px-3 rounded font-bold">追加</button>
                      </form>
                    </div>
                  ))}
                  {attributesList.length === 0 && <p className="text-gray-500 text-sm">登録されていません</p>}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}