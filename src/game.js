// ============================================
// game.js — ゲームループ＆ステージ管理
// ============================================

import { Piyo, GameObject, ParticlePool, OBJ_TYPE } from './entities.js';
import { circleVsRect, resolveCollision, circleVsCircle } from './physics.js';
import { Slingshot } from './slingshot.js';
import { Camera, Renderer, WORLD_WIDTH, WORLD_HEIGHT } from './renderer.js';
import { STAGES, WORLDS, getNextStageId } from './stages.js';
import { playSfxBounce, playSfxLaunch, playSfxBreak, playSfxExplosion, playSfxClear, playSfxFail } from './audio.js';

/** ゲーム状態 */
const STATE = {
  READY: 'ready',          // ぴよ待機中（ドラッグ可能）
  AIMING: 'aiming',        // ドラッグ中
  FLYING: 'flying',        // ぴよ飛行中
  SETTLING: 'settling',    // 着地後の判定待ち
  RESULT: 'result',        // 結果表示
  PAUSED: 'paused',        // ポーズ
};

// 地面の高さ（ワールド座標）
const GROUND_Y = WORLD_HEIGHT - 60;

// TNT爆発半径
const TNT_EXPLOSION_RADIUS = 120;
const TNT_EXPLOSION_DAMAGE = 3;

export class Game {
  constructor(renderer, inputManager) {
    this.renderer = renderer;
    this.input = inputManager;

    this.camera = new Camera();
    this.particles = new ParticlePool();
    this.slingshot = null;

    // ゲーム状態
    this.state = STATE.READY;
    this.stageId = null;
    this.stageData = null;
    this.worldData = null;

    // エンティティ
    this.piyos = [];           // 使用可能ぴよ配列
    this.currentPiyoIndex = 0;
    this.objects = [];         // ステージオブジェクト
    this.enemies = [];         // 敵リスト（objectsのサブセット参照）

    // スコア
    this.score = 0;
    this.settleTimer = 0;

    // ナイス着地テキスト表示
    this.niceLandingX = 0;
    this.niceLandingY = 0;
    this.niceLandingTimer = 0;

    // UI コールバック
    this.onScoreUpdate = null;
    this.onPiyoCountUpdate = null;
    this.onStageComplete = null;
    this.onStageFailed = null;
    this.onWaveUpdate = null;
    this.onEndlessGameOver = null;

    // エンドレスモード
    this.isEndless = false;
    this.wave = 0;

    // ゲームループ
    this._lastTime = 0;
    this._running = false;
    this._rafId = null;
    this._boundLoop = this._loop.bind(this);

    // 入力ハンドラ設定
    this._setupInput();
  }

  /**
   * ステージを初期化
   */
  initStage(stageId) {
    this.stageId = stageId;
    this.stageData = STAGES[stageId];
    if (!this.stageData) {
      console.error('[Game] ステージが見つかりません:', stageId);
      return;
    }

    this.worldData = WORLDS.find(w => w.id === this.stageData.world) || WORLDS[0];

    // リセット
    this.score = 0;
    this.currentPiyoIndex = 0;
    this.isEndless = false;           // ★ バグ修正：エンドレスフラグを明示的にリセット
    this.shotsRemaining = this.stageData.piyoCount;  // 残り発射回数
    this.state = STATE.READY;
    this.settleTimer = 0;
    this.niceLandingTimer = 0;
    this.objects.length = 0;
    this.enemies.length = 0;
    this.piyos.length = 0;
    this.camera.reset();

    // ぴよを1匹だけ生成（着地位置から再利用）
    const slX = this.stageData.slingshotX;
    const slY = this.stageData.slingshotY;
    this.piyos.push(new Piyo(slX, slY, 22, 'gelpiyo'));

    // スリングショット
    this.slingshot = new Slingshot(slX, slY);

    // オブジェクト生成
    this.stageData.objects.forEach(def => {
      const obj = new GameObject(def.x, def.y, def.w, def.h, def.type, {
        imageKey: def.imageKey || null,
        hp: def.hp
      });
      this.objects.push(obj);

      if (def.type === OBJ_TYPE.ENEMY) {
        this.enemies.push(obj);
      }
    });

    // UI更新
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
    if (this.onPiyoCountUpdate) this.onPiyoCountUpdate(this.shotsRemaining);
  }

  /**
   * エンドレスモード初期化
   */
  initEndless() {
    this.stageId = 'endless';
    this.stageData = null;
    this.isEndless = true;
    this.wave = 0;

    // ランダムなワールドテーマ
    this.worldData = WORLDS[Math.floor(Math.random() * WORLDS.length)];

    // リセット
    this.score = 0;
    this.currentPiyoIndex = 0;
    this.shotsRemaining = 3;
    this.state = STATE.READY;
    this.settleTimer = 0;
    this.niceLandingTimer = 0;
    this.objects.length = 0;
    this.enemies.length = 0;
    this.piyos.length = 0;
    this.camera.reset();

    // ぴよを中央下部に配置
    const slX = WORLD_WIDTH / 2;
    const slY = GROUND_Y - 10;
    this.piyos.push(new Piyo(slX, slY, 22, 'gelpiyo'));
    this.slingshot = new Slingshot(slX, slY);

    // 最初のウェーブ
    this._spawnWave();

    // UI更新
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
    if (this.onPiyoCountUpdate) this.onPiyoCountUpdate(this.shotsRemaining);
    if (this.onWaveUpdate) this.onWaveUpdate(this.wave);
  }

  /**
   * エンドレスモードのウェーブ生成
   */
  _spawnWave() {
    this.wave++;

    // 前のウェーブの足場やブロック、敵をすべてクリアしてリフレッシュ
    this.objects = [];
    this.enemies = [];

    // ワールドテーマ変更（毎5ウェーブ）
    if (this.wave > 1 && this.wave % 5 === 1) {
      this.worldData = WORLDS[Math.floor(Math.random() * WORLDS.length)];
    }

    // 難易度計算
    const difficulty = Math.min(this.wave, 20);
    const enemyCount = 1 + Math.floor(difficulty / 3);
    const blockCount = Math.floor(difficulty / 2);

    // 使用可能なブロックタイプ（ウェーブが進むと増える）
    const blockTypes = [OBJ_TYPE.WOOD];
    if (this.wave >= 2) blockTypes.push(OBJ_TYPE.JELLY);
    if (this.wave >= 3) blockTypes.push(OBJ_TYPE.GLASS);
    if (this.wave >= 5) blockTypes.push(OBJ_TYPE.IRON);
    if (this.wave >= 7) blockTypes.push(OBJ_TYPE.TNT);
    if (this.wave >= 10) blockTypes.push(OBJ_TYPE.SPRING);

    // 配置範囲（画面全体を使うようにマージンを減らし、上部に広げる）
    const margin = 20;
    const placeMinX = margin;
    const placeMaxX = WORLD_WIDTH - margin;
    const placeMinY = GROUND_Y - 500; // はるか上空まで
    const placeMaxY = GROUND_Y - 100;

    // ぴよの現在地（この周辺には生成しない）
    const piyo = this.piyos[0];
    const safeZoneX = piyo ? piyo.x : WORLD_WIDTH / 2;
    const safeZoneY = piyo ? piyo.y : GROUND_Y - 10;
    const safeRadius = 100;

    // 足場（プラットフォーム）の配置
    const platformCount = Math.min(2 + Math.floor(this.wave / 4), 6);
    for (let i = 0; i < platformCount; i++) {
      // 25%の確率で縦長（柱）、それ以外は横長（足場）
      const isVertical = Math.random() < 0.25;
      const pw = isVertical ? (18 + Math.random() * 12) : (80 + Math.random() * 120);
      const ph = isVertical ? (80 + Math.random() * 90) : (20 + Math.random() * 10);
      let px, py;
      let validPos = false;
      let attempts = 0;
      while (!validPos && attempts < 10) {
        px = placeMinX + Math.random() * (placeMaxX - placeMinX - pw);
        py = placeMinY + Math.random() * (placeMaxY - placeMinY - 100);
        // 安全地帯チェック
        const dist = Math.hypot((px + pw/2) - safeZoneX, (py + ph/2) - safeZoneY);
        if (dist > safeRadius + pw/2) validPos = true;
        attempts++;
      }
      const type = Math.random() > 0.3 ? OBJ_TYPE.WOOD : OBJ_TYPE.GLASS;
      this.objects.push(new GameObject(px, py, pw, ph, type, {}));
    }

    // ブロック配置
    for (let i = 0; i < blockCount; i++) {
      const type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
      // 正方形・縦長・横長をランダムに
      const shapeRoll = Math.random();
      let w, h;
      if (shapeRoll < 0.35) {
        // 縦長（ピラー）
        w = 18 + Math.random() * 12;
        h = 55 + Math.random() * 35;
      } else if (shapeRoll < 0.65) {
        // 横長
        w = 55 + Math.random() * 35;
        h = 18 + Math.random() * 12;
      } else {
        // 正方形
        const s = 33 + Math.random() * 18;
        w = s; h = s;
      }
      
      let x, y;
      let validPos = false;
      let attempts = 0;
      
      while (!validPos && attempts < 10) {
        x = placeMinX + Math.random() * (placeMaxX - placeMinX - w);
        // 地面に置くか、空中に浮かすか
        const placementChance = Math.random();
        if (placementChance < 0.3) {
          y = GROUND_Y - h;  // 地面
        } else {
          y = placeMinY + Math.random() * (placeMaxY - placeMinY); // 空中
        }
        
        // 安全地帯チェック
        const dist = Math.hypot((x + w/2) - safeZoneX, (y + h/2) - safeZoneY);
        if (dist > safeRadius) validPos = true;
        attempts++;
      }

      const obj = new GameObject(x, y, w, h, type, {});
      this.objects.push(obj);
    }

    // 敵配置
    for (let i = 0; i < enemyCount; i++) {
      const w = 45;
      const h = 45;
      let x = placeMinX + Math.random() * (placeMaxX - placeMinX - w);
      let y = placeMinY + Math.random() * (placeMaxY - placeMinY);

      // 安全地帯チェック
      const dist = Math.hypot((x + w/2) - safeZoneX, (y + h/2) - safeZoneY);
      if (dist < safeRadius) {
        y -= safeRadius; // 単純にずらす
      }

      // 敵タイプの決定
      let eType = OBJ_TYPE.ENEMY;
      let img = 'warpiyo'; // 正しい画像キー
      if (this.wave >= 3 && Math.random() < 0.15) {
        eType = OBJ_TYPE.ENEMY_BOMB;
      } else if (this.wave >= 5 && Math.random() < 0.1) {
        eType = OBJ_TYPE.ENEMY_WARP;
      }

      const enemy = new GameObject(x, y, w, h, eType, { imageKey: img });
      this.enemies.push(enemy);
      this.objects.push(enemy);
    }

    // お助けアイテムの生成（1ウェーブにつき約40%の確率で出現）
    if (Math.random() < 0.4) {
      const iType = Math.random() < 0.5 ? OBJ_TYPE.ITEM_GIANT : OBJ_TYPE.ITEM_SPLIT;
      const x = placeMinX + Math.random() * (placeMaxX - placeMinX - 40);
      const y = placeMinY + Math.random() * (placeMaxY - placeMinY - 40);
      const item = new GameObject(x, y, 40, 40, iType, {});
      item.isItem = true;
      this.objects.push(item);
    }

    // 発射回数追加（ウェーブクリアボーナス：1回復、ただし最大3まで）
    if (this.wave > 1) {
      this.shotsRemaining = Math.min(this.shotsRemaining + 1, 3);
    }

    if (this.onWaveUpdate) this.onWaveUpdate(this.wave);
    if (this.onPiyoCountUpdate) this.onPiyoCountUpdate(this.shotsRemaining);
  }

  /**
   * ゲームループ開始
   */
  start() {
    this._running = true;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  /**
   * ゲームループ停止
   */
  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * ポーズ
   */
  pause() {
    if (this.state === STATE.PAUSED) return;
    this._prevState = this.state;
    this.state = STATE.PAUSED;
  }

  /**
   * レジューム
   */
  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = this._prevState || STATE.READY;
    this._lastTime = performance.now();
  }

  // ============================================
  // メインループ
  // ============================================
  _loop(now) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._boundLoop);

    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;

    // フレーム上限（タブ復帰時の大ジャンプ防止）
    if (dt > 0.05) dt = 0.05;

    if (this.state !== STATE.PAUSED && this.state !== STATE.RESULT) {
      this._update(dt);
    }

    this._render();
  }

  _update(dt) {
    let anyLaunched = false;
    let anyFlying = false;

    // 全てのぴよを更新
    for (let i = 0; i < this.piyos.length; i++) {
      const p = this.piyos[i];
      if (p && p.launched) {
        anyLaunched = true;
        p.update(dt, WORLD_WIDTH, GROUND_Y + p.radius);
        this._checkCollisions(p);

        // 現在速度の計算
        const curSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

        // ブロック上などでの完全停止判定（衝突解決後にチェック）
        if (!p.stopped) {
          if (curSpeed < 15 && Math.abs(p.vy) < 15) {
             p.restTimer = (p.restTimer || 0) + dt;
             if (p.restTimer > 0.3) {
                this._checkNiceLanding(p);  // ★ ナイス着地チェック
                p.vx = 0;
                p.vy = 0;
                p.stopped = true;
             }
          } else {
             p.restTimer = 0;
          }
        }

        if (!p.stopped) {
          anyFlying = true;
        }
      }
    }

    const currentPiyo = this.piyos[0];
    // カメラ追従（メインのぴよのみ）
    if (currentPiyo && currentPiyo.launched) {
      this.camera.follow(currentPiyo.x, currentPiyo.y,
        WORLD_WIDTH, WORLD_HEIGHT, dt);
    }

    // オブジェクト更新
    for (let i = 0; i < this.objects.length; i++) {
      this.objects[i].update(dt);
    }

    // パーティクル更新
    this.particles.update(dt);

    // ナイス着地タイマー更新
    if (this.niceLandingTimer > 0) this.niceLandingTimer -= dt;

    // 敵全滅・コンボ上限の強制終了判定
    if (anyFlying && this.state === STATE.FLYING) {
      const remainingEnemies = this.enemies.filter(e => e.alive).length;
      // 敵全滅時は速度を急速減衰
      if (remainingEnemies === 0) {
        for (let p of this.piyos) {
          p.vx *= 0.98;
          p.vy *= 0.98;
        }
      }
      // バウンス上限（100回）超過→ 強制停止してゲームを進行させる
      if (currentPiyo && currentPiyo.bounceCount >= 100 && !currentPiyo.stopped) {
        this._checkNiceLanding(currentPiyo);
        currentPiyo.vx = 0;
        currentPiyo.vy = 0;
        currentPiyo.stopped = true;
      }
    }

    // 状態マシン
    switch (this.state) {
      case STATE.FLYING:
        if (!anyFlying && anyLaunched) {
          this.state = STATE.SETTLING;
          const remainingEnemies = this.enemies.filter(e => e.alive).length;
          this.settleTimer = (remainingEnemies === 0) ? 0.2 : 1.5;  // 敵全滅時は即座に次へ
        }
        break;

      case STATE.SETTLING:
        this.settleTimer -= dt;
        if (this.settleTimer <= 0) {
          this._onPiyoSettled();
        }
        break;
    }
  }

  /**
   * 衝突判定
   */
  _checkCollisions(piyo) {
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (!obj.alive && obj.alpha <= 0) continue;
      if (!obj.alive) continue;

      const aabb = obj.getAABB();
      const collision = circleVsRect(
        piyo.x, piyo.y, piyo.radius,
        aabb.x, aabb.y, aabb.w, aabb.h
      );

      if (!collision) continue;

      // お助けアイテムの取得
      if (obj.type === OBJ_TYPE.ITEM_GIANT || obj.type === OBJ_TYPE.ITEM_SPLIT) {
        obj.takeDamage(1);
        this._onObjectDestroyed(obj);
        this._applyItemEffect(piyo, obj.type);
        continue; // 跳ね返らない
      }

      // ワープ敵との衝突
      if (obj.type === OBJ_TYPE.ENEMY_WARP) {
        obj.takeDamage(999);
        this._onObjectDestroyed(obj);
        // ワープ処理: 画面上空にテレポート
        piyo.x = 100 + Math.random() * (WORLD_WIDTH - 200);
        piyo.y = GROUND_Y - 600 - Math.random() * 200;
        // 運動方向をランダムに
        const speed = Math.sqrt(piyo.vx * piyo.vx + piyo.vy * piyo.vy);
        const angle = (Math.random() * 90 + 45) * Math.PI / 180; // 下向き
        piyo.vx = Math.cos(angle) * speed;
        piyo.vy = Math.sin(angle) * speed;
        this.particles.emitExplosion(piyo.x, piyo.y); // ワープエフェクト代わり
        continue; // 跳ね返らない
      }

      // 巨大化時の貫通処理（鉄以外をそのまま破壊）
      if (piyo.isGiant && obj.type !== OBJ_TYPE.IRON && obj.type !== OBJ_TYPE.SPRING) {
        obj.takeDamage(999);
        this._onObjectDestroyed(obj);
        // 跳ね返らずに少し減速して突き進む
        piyo.vx *= 0.95;
        piyo.vy *= 0.95;
        this.camera.shake(10);
        continue;
      }

      // 衝突応答
      const impact = resolveCollision(piyo, collision, obj.restitution);

      if (impact > 20) {
        // バウンスエフェクト
        piyo.onBounce(impact);
        this.particles.emitBounce(collision.contactX, collision.contactY, impact);
        this.camera.shake(Math.min(impact / 100, 8));
        playSfxBounce(impact);

        // ダメージ
        if (obj.breakable) {
          const destroyed = obj.takeDamage(1);
          if (destroyed) {
            this._onObjectDestroyed(obj);
          }
        }

        // スコア加算（コンボ倍率）
        const combo = piyo.bounceCount;
        const bounceScore = 10 * combo;
        this.score += bounceScore;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score);
      }
    }
  }

  /**
   * オブジェクト破壊処理
   */
  _onObjectDestroyed(obj) {
    this.score += obj.scoreValue;
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);

    // 破壊エフェクト
    const cx = obj.getCenterX();
    const cy = obj.getCenterY();
    this.particles.emitDestroy(cx, cy, obj.color);
    playSfxBreak();

    // TNT・ボムぴよ爆発
    if (obj.type === OBJ_TYPE.TNT || obj.type === OBJ_TYPE.ENEMY_BOMB) {
      this._triggerExplosion(cx, cy);
    }
  }

  /**
   * アイテム効果の適用
   */
  _applyItemEffect(piyo, itemType) {
    if (itemType === OBJ_TYPE.ITEM_GIANT) {
      piyo.isGiant = true;
      piyo.radius *= 1.5; // サイズアップ
      this.particles.emitExplosion(piyo.x, piyo.y);
      this.camera.shake(15);
    } else if (itemType === OBJ_TYPE.ITEM_SPLIT) {
      // 分裂処理の実装
      this.particles.emitExplosion(piyo.x, piyo.y);
      // クローンを2体生成する
      const clone1 = new piyo.constructor(piyo.x, piyo.y, piyo.radius, piyo.imageKey);
      clone1.isClone = true;
      clone1.launch(piyo.vx * 0.8 + 1500, piyo.vy - 1500);
      
      const clone2 = new piyo.constructor(piyo.x, piyo.y, piyo.radius, piyo.imageKey);
      clone2.isClone = true;
      clone2.launch(piyo.vx * 0.8 - 1500, piyo.vy - 1500);

      this.piyos.push(clone1, clone2);
    }
  }

  /**
   * ナイス着地チェック（ほぼ垂直に着地したか）
   */
  _checkNiceLanding(piyo) {
    const absVx = Math.abs(piyo.vx);
    const absVy = Math.abs(piyo.vy);
    // 最終姿勢チェック：縦方向速度 > 横方向速度の1.5倍 → まっすぐ着地
    if (absVy > absVx * 1.5) {
      this.niceLandingX = piyo.x;
      this.niceLandingY = piyo.y;
      this.niceLandingTimer = 1.5;
    }
  }

  /**
   * TNT爆発
   */
  _triggerExplosion(x, y) {
    this.particles.emitExplosion(x, y);
    this.camera.shake(15);
    playSfxExplosion();

    // 範囲内のオブジェクトにダメージ
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (!obj.alive) continue;

      const dx = obj.getCenterX() - x;
      const dy = obj.getCenterY() - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TNT_EXPLOSION_RADIUS) {
        const destroyed = obj.takeDamage(TNT_EXPLOSION_DAMAGE);
        if (destroyed) {
          this.score += obj.scoreValue;
          this.particles.emitDestroy(obj.getCenterX(), obj.getCenterY(), obj.color);
          // 連鎖爆発
          if (obj.type === OBJ_TYPE.TNT || obj.type === OBJ_TYPE.ENEMY_BOMB) {
            setTimeout(() => this._triggerExplosion(obj.getCenterX(), obj.getCenterY()), 200);
          }
        }
      }
    }

    // ぴよも吹き飛ばす
    const currentPiyo = this.piyos[0];
    if (currentPiyo && currentPiyo.launched && !currentPiyo.stopped) {
      const dx = currentPiyo.x - x;
      const dy = currentPiyo.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TNT_EXPLOSION_RADIUS && dist > 0) {
        const force = (1 - dist / TNT_EXPLOSION_RADIUS) * 800;
        currentPiyo.vx += (dx / dist) * force;
        currentPiyo.vy += (dy / dist) * force;
      }
    }

    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
  }

  /**
   * ぴよが停止した後の処理
   * 同じぴよを着地位置から再びドラッグ可能にする
   */
  _onPiyoSettled() {
    // 敵全滅チェック
    const remainingEnemies = this.enemies.filter(e => e.alive).length;

    if (remainingEnemies === 0) {
      if (this.isEndless) {
        // エンドレスモード：次のウェーブへ
        // 破壊されたオブジェクトをクリーンアップ
        this.objects = this.objects.filter(o => o.alive && o.alpha > 0);
        this.enemies = this.enemies.filter(e => e.alive);

        playSfxClear();
        this._spawnWave();
        this._resetPiyoAtPosition();
        return;
      } else {
        // 通常モード：クリア
        this.state = STATE.RESULT;
        const stars = this._calcStars();
        playSfxClear();
        if (this.onStageComplete) {
          this.onStageComplete(this.score, stars);
        }
        return;
      }
    }

    // 残り発射回数を減らす
    this.shotsRemaining--;

    if (this.shotsRemaining > 0) {
      this._resetPiyoAtPosition();
    } else {
      // 発射回数切れ → ゲームオーバー
      this.state = STATE.RESULT;
      playSfxFail();
      if (this.isEndless) {
        if (this.onEndlessGameOver) {
          this.onEndlessGameOver(this.score, this.wave);
        }
      } else {
        if (this.onStageFailed) {
          this.onStageFailed(this.score);
        }
      }
    }
  }

  /**
   * ぴよを現在位置でリセット（再ドラッグ可能に）
   */
  _resetPiyoAtPosition() {
    // クローンを破棄してメインぴよだけにする
    this.piyos = [this.piyos[0]];
    const piyo = this.piyos[0];

    // スリングショットのアンカーをぴよの現在位置に移動
    this.slingshot.setAnchor(piyo.x, piyo.y);

    // ぴよの状態をリセット（位置は維持）
    piyo.launched = false;
    piyo.stopped = false;
    piyo.vx = 0;
    piyo.vy = 0;
    piyo.restTimer = 0;
    
    // 巨大化解除
    if (piyo.isGiant) {
      piyo.isGiant = false;
      piyo.radius /= 1.5;
    }

    piyo.scaleX = 1;
    piyo.scaleY = 1;
    piyo.rotation = 0;
    piyo.squashTime = -1;
    piyo.bounceCount = 0;
    piyo.comboTimer = 0;
    piyo.trailPoints.length = 0;
    piyo.isDragging = false;
    piyo.dragOffsetX = 0;
    piyo.dragOffsetY = 0;
    piyo._lastHighVx = 0;
    piyo._lastHighVy = 0;

    this.state = STATE.READY;

    // カメラをぴよの位置へ
    this.camera.follow(piyo.x, piyo.y,
      WORLD_WIDTH, WORLD_HEIGHT, 1);

    if (this.onPiyoCountUpdate) {
      this.onPiyoCountUpdate(this.shotsRemaining);
    }
  }

  /**
   * スター計算
   */
  _calcStars() {
    if (!this.stageData) return 0;
    const thresholds = this.stageData.starThresholds;
    let stars = 0;
    if (this.score >= thresholds[0]) stars = 1;
    if (this.score >= thresholds[1]) stars = 2;
    if (this.score >= thresholds[2]) stars = 3;
    // ★ 敵を全滅させてクリアした時点で最低星1個を保証（スコア関係なくクリア扱い）
    return Math.max(1, stars);
  }

  // ============================================
  // レンダリング
  // ============================================
  _render() {
    const bgColors = this.worldData ? this.worldData.bgGradient : null;
    const groundColor = this.worldData ? this.worldData.groundColor : null;

    this.renderer.beginFrame(this.camera, bgColors);

    // 背景
    this.renderer.drawBackground(bgColors, groundColor);

    // オブジェクト描画
    for (let i = 0; i < this.objects.length; i++) {
      this.renderer.drawObject(this.objects[i]);
    }

    // スリングショット描画
    const currentPiyo = this.piyos[0];
    if (this.slingshot && currentPiyo) {
      this.slingshot.render(this.renderer.ctx, currentPiyo, this.camera);
    }

    // ぴよ描画
    if (currentPiyo && currentPiyo.active) {
      this.renderer.drawPiyo(currentPiyo);

      // コンボテキスト
      if (currentPiyo.comboTimer > 0) {
        this.renderer.drawComboText(currentPiyo.x, currentPiyo.y, currentPiyo.bounceCount);
      }
    }

    // ナイス着地テキスト
    if (this.niceLandingTimer > 0) {
      this.renderer.drawNiceLanding(this.niceLandingX, this.niceLandingY, this.niceLandingTimer);
    }

    // パーティクル
    this.renderer.drawParticles(this.particles);

    this.renderer.endFrame();
  }

  // ============================================
  // 入力ハンドリング
  // ============================================
  _setupInput() {
    this.input.onDragStart = (x, y) => {
      if (this.state !== STATE.READY) return;
      const piyo = this.piyos[0];

      // Canvas座標に変換された座標をワールド座標に
      const worldPos = this._screenToWorld(x, y);
      if (this.slingshot.startDrag(worldPos.x, worldPos.y, piyo)) {
        this.state = STATE.AIMING;
      }
    };

    this.input.onDragMove = (x, y) => {
      if (this.state !== STATE.AIMING) return;
      const piyo = this.piyos[0];

      const worldPos = this._screenToWorld(x, y);
      this.slingshot.updateDrag(worldPos.x, worldPos.y, piyo);
    };

    this.input.onDragEnd = (x, y) => {
      if (this.state !== STATE.AIMING) return;
      const piyo = this.piyos[0];

      const velocity = this.slingshot.release(piyo);
      if (velocity) {
        this.state = STATE.FLYING;
        playSfxLaunch();
      } else {
        this.state = STATE.READY;
        piyo.x = this.slingshot.anchorX;
        piyo.y = this.slingshot.anchorY;
      }
    };
  }

  /**
   * スクリーン座標→ワールド座標変換
   * InputManagerはCanvas内部座標（canvas.width/height基準・DPR適用済み）を返す
   */
  _screenToWorld(screenX, screenY) {
    const r = this.renderer;
    // Canvas内部座標（DPR適用済み） → ワールド座標
    const worldX = (screenX - r.offsetX) / r.scale + this.camera.x + this.camera.shakeX;
    const worldY = (screenY - r.offsetY) / r.scale + this.camera.y + this.camera.shakeY;
    return { x: worldX, y: worldY };
  }
}
