// ============================================
// storage.js — ローカルストレージ管理
// ============================================

const STORAGE_KEY = 'gelpiyo_bounce_save';
const CURRENT_VERSION = 1;

/** デフォルトのセーブデータ */
const DEFAULT_DATA = {
  version: CURRENT_VERSION,
  highScores: {},       // { "1-1": 3500, ... }
  stageStars: {},       // { "1-1": 3, ... }
  unlockedStages: { "1-1": true },  // 最初のステージだけ解放
  unlockedCharacters: ['gelpiyo'],
  settings: {
    muted: false
  },
  totalPlayCount: 0,
  endlessBest: { score: 0, wave: 0 }  // エンドレスモード最高記録
};

let memoryFallback = null;
let storageAvailable = true;

/**
 * localStorage が使えるか確認
 */
function checkStorage() {
  try {
    const test = '__gelpiyo_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * セーブデータを読み込み
 */
export function loadData() {
  storageAvailable = checkStorage();

  if (!storageAvailable) {
    console.warn('[Storage] localStorage 利用不可。メモリフォールバック中。');
    if (!memoryFallback) {
      memoryFallback = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    return memoryFallback;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // 初回起動
      const data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      saveData(data);
      return data;
    }

    let data = JSON.parse(raw);

    // バージョンマイグレーション
    if (!data.version || data.version < CURRENT_VERSION) {
      data = migrateData(data);
      saveData(data);
    }

    return data;
  } catch (e) {
    console.error('[Storage] データ読み込み失敗:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

/**
 * セーブデータを保存
 */
export function saveData(data) {
  if (!storageAvailable) {
    memoryFallback = data;
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[Storage] 保存失敗:', e);
  }
}

/**
 * ステージクリア結果を保存
 */
export function saveStageResult(stageId, score, stars) {
  const data = loadData();

  // ハイスコア更新
  if (!data.highScores[stageId] || score > data.highScores[stageId]) {
    data.highScores[stageId] = score;
  }

  // スター更新（最大値のみ保存）
  if (!data.stageStars[stageId] || stars > data.stageStars[stageId]) {
    data.stageStars[stageId] = stars;
  }

  data.totalPlayCount++;
  saveData(data);
  return data;
}

/**
 * ステージを解放
 */
export function unlockStage(stageId) {
  const data = loadData();
  data.unlockedStages[stageId] = true;
  saveData(data);
}

/**
 * エンドレスモードの結果を保存
 * @returns {{ isNewRecord: boolean, prevBest: {score, wave} }} 自己ベスト更新情報
 */
export function saveEndlessResult(score, wave) {
  const data = loadData();
  if (!data.endlessBest) {
    data.endlessBest = { score: 0, wave: 0 };
  }
  const prevBest = { ...data.endlessBest };
  let isNewRecord = false;

  if (score > data.endlessBest.score) {
    data.endlessBest.score = score;
    isNewRecord = true;
  }
  if (wave > data.endlessBest.wave) {
    data.endlessBest.wave = wave;
    isNewRecord = true;
  }

  data.totalPlayCount++;
  saveData(data);
  return { isNewRecord, prevBest, best: data.endlessBest };
}

/**
 * キャラクターを解放
 */
export function unlockCharacter(charId) {
  const data = loadData();
  if (!data.unlockedCharacters.includes(charId)) {
    data.unlockedCharacters.push(charId);
    saveData(data);
  }
}

/**
 * データマイグレーション
 */
function migrateData(oldData) {
  const data = JSON.parse(JSON.stringify(DEFAULT_DATA));

  // 旧データからの復元を試みる
  if (oldData.highScores) data.highScores = oldData.highScores;
  if (oldData.stageStars) data.stageStars = oldData.stageStars;
  if (oldData.unlockedStages) data.unlockedStages = oldData.unlockedStages;
  if (oldData.unlockedCharacters) data.unlockedCharacters = oldData.unlockedCharacters;
  if (oldData.settings) data.settings = { ...data.settings, ...oldData.settings };
  if (oldData.totalPlayCount) data.totalPlayCount = oldData.totalPlayCount;
  if (oldData.endlessBest) data.endlessBest = oldData.endlessBest;

  data.version = CURRENT_VERSION;
  return data;
}

/**
 * ストレージが利用可能かどうか
 */
export function isStorageAvailable() {
  return storageAvailable;
}
