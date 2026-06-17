// ============================================
// main.js — アプリケーションエントリーポイント
// ============================================

import { InputManager } from './input.js';
import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { UIManager } from './ui.js';
import { initAudio, toggleMute, getMuted } from './audio.js';
import { loadData, saveStageResult, unlockStage, saveEndlessResult } from './storage.js';
import { getStageIds, getNextStageId } from './stages.js';

// ============================================
// アプリケーション
// ============================================
class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager(this.canvas);
    this.game = new Game(this.renderer, this.input);
    this.ui = new UIManager();

    this.saveData = loadData();
    this.currentStageId = null;

    this._loadAssets().then(() => {
      this._setupCallbacks();
      this._init();
    });
  }

  /**
   * アセット読み込み
   */
  async _loadAssets() {
    const assetMap = {
      'gelpiyo': 'assets/characters/23-001-ゲルぴよ.jpg',
      'momopiyo': 'assets/characters/23-002モモぴよ.jpg',
      'rainbow': 'assets/characters/23-010レインボー.jpg',
      'goldpiyo': 'assets/characters/ゴールドぴよ.png',
      'mekapiyo': 'assets/characters/メカぴよ_正面.png',
      'burapiyo': 'assets/characters/24-006ブラぴよ_正面.png',
      'warpiyo': 'assets/characters/24-006ブラぴよ_正面.png',  // ワルぴよ = ブラぴよ使用
      'hatoPiyo': 'assets/characters/ハトぴよ.png',
      'dokanPiyo': 'assets/characters/ドカンぴよ.png',
      'protoPiyo': 'assets/characters/プロトぴよ.png',
    };

    const loadImage = (key, src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // 白背景の透過処理
          const processed = this._processTransparency(img);
          this.renderer.setImage(key, processed);
          resolve();
        };
        img.onerror = () => {
          console.warn(`[Assets] 画像読み込み失敗: ${key} (${src})`);
          resolve();  // 失敗してもフォールバック描画がある
        };
        img.src = src;
      });
    };

    // 並列ロード
    await Promise.all(
      Object.entries(assetMap).map(([key, src]) => loadImage(key, src))
    );

    console.log('[Assets] 全アセット読み込み完了');
  }

  /**
   * 白背景をアルファ透過に変換（クロマキー透過）
   */
  _processTransparency(img) {
    const canvas = document.createElement('canvas');
    const size = Math.min(img.width, img.height, 256); // パフォーマンス用にリサイズ
    const scale = size / Math.max(img.width, img.height);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 白に近いピクセルを透過（背景除去）
      // RGB全てが閾値以上なら透過
      const threshold = 235;
      if (r > threshold && g > threshold && b > threshold) {
        data[i + 3] = 0;
      } else {
        // 白に近いほど半透明に（エッジをなめらかに）
        const whiteness = Math.min(r, g, b);
        if (whiteness > 200) {
          const alpha = Math.round(255 * (1 - (whiteness - 200) / 55));
          data[i + 3] = Math.min(data[i + 3], alpha);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * 初期化
   */
  _init() {
    // ミュート状態の復元
    if (this.saveData.settings.muted) {
      initAudio();
      toggleMute();
      this.ui.btnSoundToggle.textContent = '🔇';
    }

    // ステージ選択グリッド構築
    this._refreshStageGrid();

    // タイトル画面のハイスコア表示
    this._refreshTitleBestScore();

    // タイトル画面表示
    this.ui.showScreen('title');

    // 最初のタップでオーディオ初期化
    const initOnce = () => {
      initAudio();
      document.removeEventListener('click', initOnce);
      document.removeEventListener('touchstart', initOnce);
    };
    document.addEventListener('click', initOnce);
    document.addEventListener('touchstart', initOnce);

    console.log('[App] 初期化完了');
  }

  /**
   * コールバック設定
   */
  _setupCallbacks() {
    // UI → App
    this.ui.onStartGame = () => {
      this._refreshStageGrid();
    };

    // タイトル画面のエンドレスメインボタンから直接エンドレスへ
    this.ui.onEndlessMain = () => {
      this._startEndless();
    };

    this.ui.onSelectStage = (stageId) => {
      this._startStage(stageId);
    };

    this.ui.onEndless = () => {
      this._startEndless();
    };

    this.ui.onPause = () => {
      this.game.pause();
    };

    this.ui.onResume = () => {
      this.game.resume();
    };

    this.ui.onRetry = () => {
      if (this.currentStageId === 'endless') {
        this._startEndless();
      } else if (this.currentStageId) {
        this._startStage(this.currentStageId);
      }
    };

    this.ui.onNextStage = () => {
      const next = getNextStageId(this.currentStageId);
      if (next) {
        this._startStage(next);
      } else {
        this.ui.showScreen('stageSelect');
        this._refreshStageGrid();
        this.game.stop();
      }
    };

    this.ui.onQuit = () => {
      this.game.stop();
      this._refreshStageGrid();
    };

    this.ui.onToggleSound = () => {
      initAudio();
      const muted = toggleMute();
      this.saveData.settings.muted = muted;
      return muted;
    };

    // Game → App
    this.game.onScoreUpdate = (score) => {
      this.ui.updateScore(score);
    };

    this.game.onPiyoCountUpdate = (count) => {
      this.ui.updatePiyoCount(count);
    };

    this.game.onStageComplete = (score, stars) => {
      // セーブ
      this.saveData = saveStageResult(this.currentStageId, score, stars);

      // 次のステージ解放
      const next = getNextStageId(this.currentStageId);
      if (next) {
        unlockStage(next);
        this.saveData.unlockedStages[next] = true;
      }

      this.ui.showResult(score, stars);
    };

    this.game.onStageFailed = (score) => {
      this.ui.showFailed(score);
    };

    this.game.onWaveUpdate = (wave) => {
      this.ui.updateWave(wave);
    };

    this.game.onEndlessGameOver = (score, wave) => {
      // エンドレスハイスコアを保存し、自己ベスト更新情報をUIに渡す
      const { isNewRecord } = saveEndlessResult(score, wave);
      this.saveData = loadData();  // 最新データを再読み込み
      this._refreshTitleBestScore();
      this.ui.showEndlessGameOver(score, wave, isNewRecord);
    };
  }

  /**
   * 通常ステージ開始
   */
  _startStage(stageId) {
    this.currentStageId = stageId;
    this.game.stop();
    this.ui.hideWave();
    this.game.initStage(stageId);
    this.game.start();
    this.ui.showScreen('hud');
  }

  /**
   * エンドレスモード開始
   */
  _startEndless() {
    this.currentStageId = 'endless';
    this.game.stop();
    this.game.initEndless();
    this.game.start();
    this.ui.showScreen('hud');
  }

  /**
   * ステージ選択画面を更新
   */
  _refreshStageGrid() {
    this.saveData = loadData();
    this.ui.buildStageGrid(
      getStageIds(),
      this.saveData.stageStars,
      this.saveData.unlockedStages
    );
  }

  /**
   * タイトル画面のエンドレスハイスコアを更新表示
   */
  _refreshTitleBestScore() {
    const best = this.saveData.endlessBest || { score: 0, wave: 0 };
    this.ui.updateTitleBestScore(best.score, best.wave);
  }
}

// ============================================
// 起動
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
