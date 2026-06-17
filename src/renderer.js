// ============================================
// renderer.js — Canvas描画処理
// ============================================

import { OBJ_TYPE } from './entities.js';

// ワールド座標系のサイズ
export const WORLD_WIDTH = 400;
export const WORLD_HEIGHT = 710;

/**
 * カメラ（ビューポート）
 */
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
  }

  /**
   * ターゲットに追従
   */
  follow(targetX, targetY, viewWidth, viewHeight, dt) {
    this.targetX = Math.max(0, Math.min(targetX - viewWidth / 2, WORLD_WIDTH - viewWidth));
    this.targetY = Math.max(0, Math.min(targetY - viewHeight / 2, WORLD_HEIGHT - viewHeight));

    // 滑らかに追従
    this.x += (this.targetX - this.x) * Math.min(dt * 3, 1);
    this.y += (this.targetY - this.y) * Math.min(dt * 3, 1);

    // 画面シェイク
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const decay = this.shakeTimer / 0.3;
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity * decay * 2;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity * decay * 2;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  /**
   * 画面シェイクを発動
   */
  shake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = 0.3;
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
  }
}

/**
 * メインレンダラー
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = {};    // ロード済み画像

    // 描画倍率
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this.resize();
  }

  /**
   * リサイズ処理
   */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // ワールドのアスペクト比に合わせてフィット
    const worldAspect = WORLD_WIDTH / WORLD_HEIGHT;
    const screenAspect = containerWidth / containerHeight;

    let drawWidth, drawHeight;
    if (screenAspect > worldAspect) {
      // 横長 → 高さに合わせる
      drawHeight = containerHeight;
      drawWidth = drawHeight * worldAspect;
    } else {
      // 縦長 → 幅に合わせる
      drawWidth = containerWidth;
      drawHeight = drawWidth / worldAspect;
    }

    this.canvas.style.width = containerWidth + 'px';
    this.canvas.style.height = containerHeight + 'px';
    this.canvas.width = containerWidth * dpr;
    this.canvas.height = containerHeight * dpr;

    this.scale = drawWidth / WORLD_WIDTH * dpr;
    this.offsetX = (containerWidth * dpr - drawWidth * dpr) / 2;
    this.offsetY = (containerHeight * dpr - drawHeight * dpr) / 2;
  }

  /**
   * フレーム開始
   */
  beginFrame(camera, bgColors) {
    const ctx = this.ctx;
    ctx.save();

    // 背景クリア
    ctx.fillStyle = bgColors ? bgColors[0] : '#0f0f23';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // ワールド空間への変換
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-(camera.x + camera.shakeX), -(camera.y + camera.shakeY));
  }

  /**
   * フレーム終了
   */
  endFrame() {
    this.ctx.restore();
  }

  /**
   * 背景描画（グラデーション空 + 地面）
   */
  drawBackground(bgColors, groundColor) {
    const ctx = this.ctx;

    // 空グラデーション
    if (bgColors && bgColors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
      bgColors.forEach((color, i) => {
        grad.addColorStop(i / (bgColors.length - 1), color);
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    // 地面
    const groundY = WORLD_HEIGHT - 60;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, WORLD_HEIGHT);
    groundGrad.addColorStop(0, groundColor || '#2d5a3d');
    groundGrad.addColorStop(1, darkenColor(groundColor || '#2d5a3d', 40));
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, WORLD_WIDTH, 60);

    // 地面のライン
    ctx.strokeStyle = lightenColor(groundColor || '#2d5a3d', 30);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(WORLD_WIDTH, groundY);
    ctx.stroke();

    // 星パーティクル（背景装飾）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 127 + 53) % WORLD_WIDTH);
      const sy = ((i * 89 + 17) % (WORLD_HEIGHT - 100));
      const size = 1 + (i % 3);
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * ゲルぴよ（プレイヤー）を描画
   */
  drawPiyo(piyo) {
    const ctx = this.ctx;
    if (!piyo.active || piyo.alpha <= 0) return;

    // 軌跡
    this._drawTrail(piyo);

    ctx.save();
    ctx.globalAlpha = piyo.alpha;
    ctx.translate(piyo.x, piyo.y);
    ctx.rotate(piyo.rotation);
    ctx.scale(piyo.scaleX, piyo.scaleY);

    const r = piyo.radius;
    const img = this.images[piyo.imageKey];

    if (img) {
      // 画像描画
      ctx.drawImage(img, -r, -r, r * 2, r * 2);
    } else {
      // フォールバック：黄色い丸＋顔
      this._drawFallbackPiyo(ctx, r);
    }

    ctx.restore();
  }

  /**
   * フォールバックのゲルぴよ描画（画像なし時）
   */
  _drawFallbackPiyo(ctx, r) {
    // 本体（グラデーション円）
    const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
    bodyGrad.addColorStop(0, '#ffe44d');
    bodyGrad.addColorStop(0.7, '#ffd000');
    bodyGrad.addColorStop(1, '#e6b800');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    // 卵型（少し下が丸い）
    ctx.ellipse(0, r * 0.05, r * 0.85, r, 0, 0, Math.PI * 2);
    ctx.fill();

    // ゲル感のハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, -r * 0.35, r * 0.35, r * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 目
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 目のハイライト
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.15, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.28, -r * 0.15, r * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // くちばし
    ctx.fillStyle = '#ff9933';
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, r * 0.05);
    ctx.lineTo(r * 0.08, r * 0.05);
    ctx.lineTo(0, r * 0.18);
    ctx.closePath();
    ctx.fill();

    // アホ毛
    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.3, r * 0.1, -r * 1.15);
    ctx.stroke();

    // 小さな羽
    ctx.fillStyle = '#ffd000';
    // 左羽
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, r * 0.05, r * 0.18, r * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // 右羽
    ctx.beginPath();
    ctx.ellipse(r * 0.85, r * 0.05, r * 0.18, r * 0.12, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 軌跡描画
   */
  _drawTrail(piyo) {
    const ctx = this.ctx;
    if (piyo.trailPoints.length < 2) return;

    for (let i = 1; i < piyo.trailPoints.length; i++) {
      const p = piyo.trailPoints[i];
      const prevP = piyo.trailPoints[i - 1];
      const alpha = p.alpha * 0.4;
      const width = 3 * p.alpha;

      ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prevP.x, prevP.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  /**
   * ゲームオブジェクト描画
   */
  drawObject(obj) {
    const ctx = this.ctx;
    if (obj.alpha <= 0) return;

    const shake = obj.getShakeOffset();
    const wobble = obj.getWobbleOffset();

    ctx.save();
    ctx.globalAlpha = obj.alpha;
    ctx.translate(
      obj.x + obj.width / 2 + shake.x,
      obj.y + obj.height / 2 + shake.y + wobble
    );

    const hw = obj.width / 2;
    const hh = obj.height / 2;

    const img = obj.imageKey ? this.images[obj.imageKey] : null;

    if (img && (obj.type === OBJ_TYPE.ENEMY || obj.type === OBJ_TYPE.ENEMY_BOMB || obj.type === OBJ_TYPE.ENEMY_WARP)) {
      // 敵キャラ画像にタイプごとの色合いフィルターを重ねる（簡易表現）
      ctx.drawImage(img, -hw, -hh, obj.width, obj.height);
      if (obj.type === OBJ_TYPE.ENEMY_BOMB) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, hw, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === OBJ_TYPE.ENEMY_WARP) {
        ctx.fillStyle = 'rgba(150, 0, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, hw, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // タイプ別描画
      switch (obj.type) {
        case OBJ_TYPE.JELLY:
          this._drawJellyBlock(ctx, hw, hh, obj);
          break;
        case OBJ_TYPE.WOOD:
          this._drawWoodBlock(ctx, hw, hh, obj);
          break;
        case OBJ_TYPE.IRON:
          this._drawIronBlock(ctx, hw, hh, obj);
          break;
        case OBJ_TYPE.GLASS:
          this._drawGlassBlock(ctx, hw, hh, obj);
          break;
        case OBJ_TYPE.TNT:
          this._drawTNTBlock(ctx, hw, hh, obj);
          break;
        case OBJ_TYPE.SPRING:
          this._drawSpring(ctx, hw, hh, obj);
          break;
        case OBJ_TYPE.ENEMY:
          this._drawEnemyFallback(ctx, hw, hh, obj, '#ff6b9d');
          break;
        case OBJ_TYPE.ENEMY_BOMB:
          this._drawEnemyFallback(ctx, hw, hh, obj, '#aa0000');
          break;
        case OBJ_TYPE.ENEMY_WARP:
          this._drawEnemyFallback(ctx, hw, hh, obj, '#aa00ff');
          break;
        case OBJ_TYPE.ITEM_GIANT:
          this._drawItemBubble(ctx, hw, hh, obj, 'GIANT');
          break;
        case OBJ_TYPE.ITEM_SPLIT:
          this._drawItemBubble(ctx, hw, hh, obj, 'SPLIT');
          break;
      }

      // ひび割れ描画
      if (obj.crackLevel > 0 && obj.alive) {
        this._drawCracks(ctx, hw, hh, obj.crackLevel);
      }
    }

    ctx.restore();
  }

  _drawJellyBlock(ctx, hw, hh, obj) {
    ctx.save();
    // ネオングリーングロウ
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 14;
    // 半透明フィル
    ctx.fillStyle = 'rgba(0, 255, 136, 0.18)';
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 8);
    ctx.fill();
    // ネオン框線
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 8);
    ctx.stroke();
    // 内側ハイライト
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.2, -hh * 0.3, hw * 0.4, hh * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawWoodBlock(ctx, hw, hh, obj) {
    ctx.save();
    // ネオン琥珀色グロウ
    ctx.shadowColor = '#ffaa44';
    ctx.shadowBlur = 10;
    // ベース塩り
    const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
    grad.addColorStop(0, 'rgba(200, 140, 60, 0.88)');
    grad.addColorStop(1, 'rgba(150, 95, 25, 0.88)');
    ctx.fillStyle = grad;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4);
    ctx.fill();
    // 木目線（思い切り）
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.25)';
    ctx.lineWidth = 1;
    const lineCount = Math.max(2, Math.floor(hh * 0.15));
    for (let i = 0; i < lineCount; i++) {
      const y = -hh + (hh * 2 / (lineCount + 1)) * (i + 1);
      ctx.beginPath();
      ctx.moveTo(-hw + 4, y);
      ctx.bezierCurveTo(-hw * 0.3, y - 2, hw * 0.3, y + 2, hw - 4, y);
      ctx.stroke();
    }
    // ネオン框線
    ctx.shadowColor = '#ffaa44';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffaa44';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4);
    ctx.stroke();
    ctx.restore();
  }

  _drawIronBlock(ctx, hw, hh, obj) {
    ctx.save();
    // ネオンスチールブルーグロウ
    ctx.shadowColor = '#4499dd';
    ctx.shadowBlur = 10;
    // メタリックグラデーション
    const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
    grad.addColorStop(0, 'rgba(100, 130, 170, 0.92)');
    grad.addColorStop(0.5, 'rgba(140, 175, 210, 0.92)');
    grad.addColorStop(1, 'rgba(80, 110, 155, 0.92)');
    ctx.fillStyle = grad;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 3);
    ctx.fill();
    // ネオン框線
    ctx.strokeStyle = '#7bbcee';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 3);
    ctx.stroke();
    // ネオンボルト
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#00d4ff';
    const boltR = Math.min(4, Math.min(hw, hh) * 0.2);
    const boltPositions = [
      [-hw + boltR + 4, -hh + boltR + 4],
      [hw - boltR - 4, -hh + boltR + 4],
      [-hw + boltR + 4, hh - boltR - 4],
      [hw - boltR - 4, hh - boltR - 4]
    ];
    boltPositions.forEach(([bx, by]) => {
      ctx.beginPath();
      ctx.arc(bx, by, boltR, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _drawGlassBlock(ctx, hw, hh, obj) {
    ctx.save();
    // ネオンシアングロウ
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 15;
    // 透明フィル
    ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4);
    ctx.fill();
    // ネオン框線
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 4);
    ctx.stroke();
    // ハイライト三角
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(-hw + 4, -hh + 4);
    ctx.lineTo(hw * 0.3, -hh + 4);
    ctx.lineTo(-hw + 4, hh * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawTNTBlock(ctx, hw, hh, obj) {
    ctx.save();
    // ネオン赤グロウ
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 16;
    // ベース
    const grad = ctx.createLinearGradient(-hw, 0, hw, 0);
    grad.addColorStop(0, 'rgba(170, 18, 40, 0.92)');
    grad.addColorStop(0.5, 'rgba(255, 40, 70, 0.92)');
    grad.addColorStop(1, 'rgba(170, 18, 40, 0.92)');
    ctx.fillStyle = grad;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 6);
    ctx.fill();
    // 警告ストライプ
    ctx.shadowBlur = 0;
    const stripeCount = 3;
    const stripeW = (hw * 2) / (stripeCount * 2 - 1);
    ctx.fillStyle = 'rgba(255, 180, 0, 0.2)';
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillRect(-hw + stripeW * i * 2, -hh, stripeW, hh * 2);
    }
    // ネオン框線
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ff6688';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, 6);
    ctx.stroke();
    // 爆弾絵文字
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(hw, hh) * 0.85}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', 0, 0);
    ctx.restore();
  }

  _drawSpring(ctx, hw, hh, obj) {
    // バネ台
    ctx.fillStyle = '#ffdd00';
    ctx.fillRect(-hw, hh * 0.3, hw * 2, hh * 0.7);

    // コイル
    ctx.strokeStyle = '#cc8800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = -hh + (hh * 2 * 0.3 / 4) * (i + 0.5) + hh * 0.3;
      ctx.moveTo(-hw * 0.6, y);
      ctx.lineTo(hw * 0.6, y);
    }
    ctx.stroke();
  }

  _drawEnemyFallback(ctx, hw, hh, obj) {
    // フォールバック敵描画（ワルぴよ風）
    const bodyGrad = ctx.createRadialGradient(-hw * 0.2, -hh * 0.3, 0, 0, 0, Math.max(hw, hh));
    bodyGrad.addColorStop(0, '#ffe44d');
    bodyGrad.addColorStop(1, '#e6b800');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, hh * 0.05, hw * 0.85, hh * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // サングラス
    ctx.fillStyle = '#111';
    roundRect(ctx, -hw * 0.7, -hh * 0.3, hw * 1.4, hh * 0.3, 4);
    ctx.fill();

    // くちばし
    ctx.fillStyle = '#ff9933';
    ctx.beginPath();
    ctx.moveTo(-hw * 0.1, hh * 0.05);
    ctx.lineTo(hw * 0.1, hh * 0.05);
    ctx.lineTo(0, hh * 0.2);
    ctx.closePath();
    ctx.fill();

    // 傷跡
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hw * 0.35, -hh * 0.1);
    ctx.lineTo(hw * 0.55, hh * 0.15);
    ctx.moveTo(hw * 0.35, hh * 0.15);
    ctx.lineTo(hw * 0.55, -hh * 0.1);
    ctx.stroke();
  }

  _drawCracks(ctx, hw, hh, level) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;

    // ひび割れの本数はレベルに比例
    const count = Math.ceil(level * 4);
    for (let i = 0; i < count; i++) {
      const sx = (Math.sin(i * 2.7) * hw * 0.8);
      const sy = (Math.cos(i * 3.1) * hh * 0.8);
      const ex = sx + (Math.cos(i * 1.3) * hw * 0.5);
      const ey = sy + (Math.sin(i * 1.7) * hh * 0.5);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      // 枝分かれ
      const bx = ex + (Math.sin(i * 4.3) * hw * 0.2);
      const by = ey + (Math.cos(i * 5.1) * hh * 0.2);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }

  /**
   * パーティクルプールを描画
   */
  drawParticles(pool) {
    const ctx = this.ctx;
    for (let i = 0; i < pool.particles.length; i++) {
      const p = pool.particles[i];
      if (!p.active) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      switch (p.type) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'star':
          this._drawStar(ctx, p.size);
          break;
        case 'square':
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;
      }

      ctx.restore();
    }
  }

  _drawStar(ctx, size) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * シャボン玉アイテムの描画
   */
  _drawItemBubble(ctx, hw, hh, obj, typeLabel) {
    const r = Math.min(hw, hh);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    
    // シャボン玉の色
    const color = typeLabel === 'GIANT' ? '255, 100, 100' : '255, 255, 100';
    
    grad.addColorStop(0, `rgba(${color}, 0.8)`);
    grad.addColorStop(0.7, `rgba(${color}, 0.3)`);
    grad.addColorStop(1, `rgba(${color}, 0.9)`);
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // ハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.4, r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // 文字
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(r * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(typeLabel, 0, 0);
    ctx.shadowBlur = 0; // reset
  }

  /**
   * 敵（ワルぴよ）フォールバック
   */
  _drawEnemyFallback(ctx, hw, hh, obj, baseColor = '#ff6b9d') {
    const r = Math.min(hw, hh);

    // ボディ
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 悪そうな目
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.3);
    ctx.lineTo(-r * 0.1, -r * 0.1);
    ctx.lineTo(-r * 0.4, 0);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(r * 0.4, -r * 0.3);
    ctx.lineTo(r * 0.1, -r * 0.1);
    ctx.lineTo(r * 0.4, 0);
    ctx.fill();

    // 牙
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.2);
    ctx.lineTo(0, r * 0.4);
    ctx.lineTo(r * 0.1, r * 0.2);
    ctx.fill();
  }

  /**
   * コンボテキスト描画
   */
  drawComboText(x, y, bounceCount) {
    if (bounceCount < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(`${bounceCount} COMBO!`, x, y - 40);
    ctx.restore();
  }

  /**
   * ナイス着地テキスト描画
   */
  drawNiceLanding(x, y, timer) {
    if (timer <= 0) return;
    const ctx = this.ctx;
    ctx.save();

    // フェードアウト + 浮き上がり
    const alpha = Math.min(1, timer * 2.5);
    const floatY = (1.5 - timer) * 25;  // 上に浮いていく
    const scale = 1.0 + Math.max(0, (0.5 - timer)) * 0.3;

    ctx.globalAlpha = alpha;
    ctx.translate(x, y - 55 - floatY);
    ctx.scale(scale, scale);

    // ネオングロウ
    ctx.shadowColor = '#ffde00';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffde00';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ナイス着地！🛘', 0, 0);

    ctx.restore();
  }

  /**
   * 画像を登録
   */
  setImage(key, img) {
    this.images[key] = img;
  }

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
  }
}

// ============================================
// ユーティリティ
// ============================================

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}
