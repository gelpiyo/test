// ============================================
// ui.js — UI管理（HTML要素の操作）
// ============================================

import { playSfxTap, playSfxStar } from './audio.js';

/**
 * UI管理クラス
 */
export class UIManager {
  constructor() {
    // 画面要素
    this.screens = {
      title: document.getElementById('title-screen'),
      howto: document.getElementById('howto-screen'),
      stageSelect: document.getElementById('stage-select-screen'),
      hud: document.getElementById('game-hud'),
      pause: document.getElementById('pause-screen'),
      result: document.getElementById('result-screen'),
    };

    // ボタン
    this.btnStart = document.getElementById('btn-start');
    this.btnHowTo = document.getElementById('btn-how-to');
    this.btnHowToBack = document.getElementById('btn-howto-back');
    this.btnStageBack = document.getElementById('btn-stage-back');
    this.btnPause = document.getElementById('btn-pause');
    this.btnResume = document.getElementById('btn-resume');
    this.btnRetryPause = document.getElementById('btn-retry-pause');
    this.btnQuit = document.getElementById('btn-quit');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnNext = document.getElementById('btn-next');
    this.btnToStages = document.getElementById('btn-to-stages');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.btnEndless = document.getElementById('btn-endless');
    this.btnEndlessMain = document.getElementById('btn-endless-main');  // タイトル画面のメインボタン

    // HUD要素
    this.hudScoreValue = document.getElementById('hud-score-value');
    this.hudPiyoIcons = document.getElementById('hud-piyo-icons');
    this.hudWaveDisplay = document.getElementById('hud-wave-display');
    this.hudWaveValue = document.getElementById('hud-wave-value');

    // タイトルハイスコア要素
    this.titleBestScore = document.getElementById('title-best-score');
    this.titleBestScoreVal = document.getElementById('title-best-score-val');
    this.titleBestWaveVal = document.getElementById('title-best-wave-val');

    // リザルト要素
    this.resultTitle = document.getElementById('result-title');
    this.resultStars = document.getElementById('result-stars');
    this.resultScoreValue = document.getElementById('result-score-value');
    this.resultWave = document.getElementById('result-wave');
    this.resultWaveValue = document.getElementById('result-wave-value');

    // ステージグリッド
    this.stageGrid = document.getElementById('stage-grid');

    // コールバック
    this.onStartGame = null;
    this.onSelectStage = null;
    this.onEndless = null;
    this.onEndlessMain = null;  // タイトル画面のメインボタンから直接エンドレス起動
    this.onPause = null;
    this.onResume = null;
    this.onRetry = null;
    this.onNextStage = null;
    this.onQuit = null;
    this.onToggleSound = null;

    this._bindButtons();
  }

  _bindButtons() {
    // タイトル画面 - エンドレスメインボタン（新規）
    if (this.btnEndlessMain) {
      this.btnEndlessMain.addEventListener('click', () => {
        playSfxTap();
        if (this.onEndlessMain) this.onEndlessMain();
      });
    }

    // タイトル画面 - ステージ選択（トレーニング）へ
    this.btnStart.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('stageSelect');
      if (this.onStartGame) this.onStartGame();
    });

    this.btnHowTo.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('howto');
    });

    this.btnHowToBack.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('title');
    });

    // ステージ選択
    this.btnStageBack.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('title');
    });

    // エンドレスモード
    this.btnEndless.addEventListener('click', () => {
      playSfxTap();
      if (this.onEndless) this.onEndless();
    });

    // ポーズ
    this.btnPause.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('pause');
      if (this.onPause) this.onPause();
    });

    this.btnResume.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('hud');
      if (this.onResume) this.onResume();
    });

    this.btnRetryPause.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('hud');
      if (this.onRetry) this.onRetry();
    });

    this.btnQuit.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('stageSelect');
      if (this.onQuit) this.onQuit();
    });

    // リザルト
    this.btnRetry.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('hud');
      if (this.onRetry) this.onRetry();
    });

    this.btnNext.addEventListener('click', () => {
      playSfxTap();
      if (this.onNextStage) this.onNextStage();
    });

    this.btnToStages.addEventListener('click', () => {
      playSfxTap();
      this.showScreen('stageSelect');
      if (this.onQuit) this.onQuit();
    });

    // サウンド
    this.btnSoundToggle.addEventListener('click', () => {
      if (this.onToggleSound) {
        const muted = this.onToggleSound();
        this.btnSoundToggle.textContent = muted ? '🔇' : '🔊';
      }
    });
  }

  /**
   * 画面切り替え
   */
  showScreen(screenKey) {
    Object.values(this.screens).forEach(el => {
      if (el) el.classList.remove('active');
    });
    if (this.screens[screenKey]) {
      this.screens[screenKey].classList.add('active');
    }
  }

  /**
   * ステージ選択グリッドを構築
   */
  buildStageGrid(stageIds, stageStars, unlockedStages) {
    this.stageGrid.innerHTML = '';

    stageIds.forEach(id => {
      const btn = document.createElement('button');
      btn.className = 'stage-btn';

      const isUnlocked = unlockedStages[id] || false;
      const stars = stageStars[id] || 0;
      const stageNum = id.split('-')[1];

      if (!isUnlocked) {
        btn.classList.add('locked');
        btn.innerHTML = `🔒`;
      } else {
        if (stars > 0) btn.classList.add('cleared');
        btn.innerHTML = `
          <span>${stageNum}</span>
          <span class="stage-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
        `;
        btn.addEventListener('click', () => {
          playSfxTap();
          if (this.onSelectStage) this.onSelectStage(id);
        });
      }

      this.stageGrid.appendChild(btn);
    });
  }

  /**
   * HUDスコア更新
   */
  updateScore(score) {
    if (this.hudScoreValue) {
      this.hudScoreValue.textContent = score.toLocaleString();
    }
  }

  /**
   * HUD残りぴよ数更新（ゲルぴよ画像アイコン）
   */
  updatePiyoCount(count) {
    if (this.hudPiyoIcons) {
      this.hudPiyoIcons.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const img = document.createElement('img');
        img.src = 'assets/characters/23-001-ゲルぴよ.jpg';
        img.alt = 'ゲルぴよ';
        img.className = 'hud-piyo-icon';
        this.hudPiyoIcons.appendChild(img);
      }
    }
  }

  /**
   * ウェーブ数更新（エンドレスモード）
   */
  updateWave(wave) {
    if (this.hudWaveDisplay) {
      this.hudWaveDisplay.style.display = '';
      this.hudWaveValue.textContent = wave;

      // ウェーブ切替アニメーション
      this.hudWaveValue.style.animation = 'none';
      this.hudWaveValue.offsetHeight; // reflow
      this.hudWaveValue.style.animation = 'wavePulse 0.5s ease-out';
    }
  }

  /**
   * ウェーブ表示を非表示
   */
  hideWave() {
    if (this.hudWaveDisplay) {
      this.hudWaveDisplay.style.display = 'none';
    }
  }

  /**
   * リザルト画面表示（クリア）
   */
  showResult(score, stars) {
    this.resultTitle.textContent = 'ステージクリア！';
    this.resultTitle.style.color = '#ffd700';
    this.resultScoreValue.textContent = score.toLocaleString();

    // スターアニメーション
    this.resultStars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      span.className = 'star-animated';
      span.textContent = i < stars ? '⭐' : '☆';
      span.style.animationDelay = `${i * 0.2}s`;
      this.resultStars.appendChild(span);

      if (i < stars) {
        setTimeout(() => playSfxStar(), i * 200 + 200);
      }
    }

    this.btnNext.style.display = '';
    setTimeout(() => this.showScreen('result'), 500);
  }

  /**
   * リザルト画面表示（失敗）
   */
  showFailed(score) {
    this.resultTitle.textContent = 'ざんねん…';
    this.resultTitle.style.color = '#ff6b9d';
    this.resultScoreValue.textContent = score.toLocaleString();

    this.resultStars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      span.className = 'star-animated';
      span.textContent = '☆';
      span.style.animationDelay = `${i * 0.2}s`;
      this.resultStars.appendChild(span);
    }

    this.resultWave.style.display = 'none';
    this.btnNext.style.display = 'none';
    setTimeout(() => this.showScreen('result'), 500);
  }

  /**
   * エンドレスモードゲームオーバー画面
   */
  showEndlessGameOver(score, wave, isNewRecord = false) {
    this.resultTitle.textContent = 'ゲームオーバー';
    this.resultTitle.style.color = '#ff6b9d';
    this.resultScoreValue.textContent = score.toLocaleString();

    // スターの代わりにウェーブ情報
    this.resultStars.innerHTML = '';
    this.resultWave.style.display = '';
    this.resultWaveValue.textContent = wave;

    // NEW RECORD!演出
    if (isNewRecord) {
      const record = document.createElement('div');
      record.className = 'result-new-record';
      record.textContent = '🏆 NEW RECORD!';
      this.resultStars.appendChild(record);
    }

    this.btnNext.style.display = 'none';
    setTimeout(() => this.showScreen('result'), 500);
  }

  /**
   * タイトル画面のハイスコアを更新表示する
   */
  updateTitleBestScore(score, wave) {
    if (!this.titleBestScore) return;
    if (score > 0 || wave > 0) {
      this.titleBestScore.style.display = '';
      if (this.titleBestScoreVal) this.titleBestScoreVal.textContent = score.toLocaleString();
      if (this.titleBestWaveVal) this.titleBestWaveVal.textContent = wave;
    } else {
      this.titleBestScore.style.display = 'none';
    }
  }
}
